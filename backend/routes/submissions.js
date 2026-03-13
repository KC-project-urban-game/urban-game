// ──────────────────────────────────────────────────────────────
// Submission routes – photo upload, feed & gallery
// ──────────────────────────────────────────────────────────────
const router = require('express').Router();
const Submission = require('../models/Submission');
const Team = require('../models/Team');
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const gameActive = require('../middleware/gameActive');
const { upload } = require('../config/upload');
const fullUrl = require('../utils/fullUrl');
const { getTaskStats } = require('../utils/taskStats');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const crypto = require('crypto');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const BLUR_VERSION = 'v2';

function toUploadUrlFromAbsolute(absPath) {
  return `/uploads/${path.basename(absPath)}`;
}

function originalPathFor(photoUrl) {
  if (!photoUrl || typeof photoUrl !== 'string' || !photoUrl.startsWith('/uploads/')) {
    return null;
  }

  return path.join(uploadsDir, path.basename(photoUrl));
}

function blurPathFor(photoBlurUrl) {
  if (!photoBlurUrl || typeof photoBlurUrl !== 'string' || !photoBlurUrl.startsWith('/uploads/')) {
    return null;
  }

  return path.join(uploadsDir, path.basename(photoBlurUrl));
}

function isCurrentBlurVariant(photoBlurUrl) {
  if (!photoBlurUrl || typeof photoBlurUrl !== 'string') return false;
  return path.basename(photoBlurUrl).includes(`-blur-${BLUR_VERSION}.jpg`);
}

async function deleteFileIfExists(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch (_err) {
    // Best effort only.
  }
}

async function createBlurFromOriginal(originalPath) {
  const blurFilename = `${crypto.randomUUID()}-blur-${BLUR_VERSION}.jpg`;
  const blurPath = path.join(uploadsDir, blurFilename);

  const image = sharp(originalPath).rotate();
  const metadata = await image.metadata();
  const width = Math.max(24, Math.floor((metadata.width || 1200) * 0.06));
  const height = Math.max(24, Math.floor((metadata.height || 900) * 0.06));

  await image
    .resize(width, height, { fit: 'fill' })
    .blur(42)
    .resize(metadata.width || null, metadata.height || null, { kernel: sharp.kernel.nearest, fit: 'fill' })
    .modulate({ saturation: 0.6, brightness: 0.9 })
    .jpeg({ quality: 28 })
    .toFile(blurPath);

  return blurPath;
}

async function ensureBlurredVariantPath(photoUrl, photoBlurUrl) {
  const existingBlurPath = blurPathFor(photoBlurUrl);
  if (existingBlurPath && isCurrentBlurVariant(photoBlurUrl)) {
    try {
      await fs.access(existingBlurPath);
      return existingBlurPath;
    } catch (_err) {
      // Fallback to regenerate from original if missing.
    }
  }

  const originalPath = originalPathFor(photoUrl);
  if (!originalPath) {
    return null;
  }

  try {
    await fs.access(originalPath);
    await deleteFileIfExists(existingBlurPath);
    return await createBlurFromOriginal(originalPath);
  } catch (_err) {
    // Never leak original image to non-owners if blur transform fails.
    return null;
  }
}

// Authenticated photo delivery for feed items.
// Owners/admin get the original image; competitors get a blurred server-generated variant.
router.get('/:submissionId/photo', auth, async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.submissionId)
      .select('team photoUrl photoBlurUrl status blockedAt');
    if (!submission || !submission.photoUrl || submission.status !== 'completed' || submission.blockedAt) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const isOwner = String(submission.team) === String(req.teamId);
    const isPrivileged = isOwner || req.role === 'admin';

    let filePath;
    if (isPrivileged) {
      filePath = originalPathFor(submission.photoUrl);
    } else {
      filePath = await ensureBlurredVariantPath(submission.photoUrl, submission.photoBlurUrl);

      // Persist generated/current blurred filename so stale variants are replaced.
      if (filePath && submission.photoBlurUrl !== toUploadUrlFromAbsolute(filePath)) {
        submission.photoBlurUrl = toUploadUrlFromAbsolute(filePath);
        await submission.save();
      }
    }

    if (!filePath) {
      return res.status(404).json({ error: 'Photo not available' });
    }

    await fs.access(filePath);
    if (!isPrivileged) {
      res.type('jpg');
    }
    return res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

// ★ Upload photo – STOPS the server-side timer
router.post('/:taskId/upload', auth, gameActive, upload.single('photo'), async (req, res, next) => {
  try {
    const submission = await Submission.findOne({
      team: req.teamId,
      task: req.params.taskId,
    });

    if (!submission) {
      return res.status(400).json({ error: 'You must open the riddle before uploading' });
    }
    if (submission.status === 'completed') {
      return res.status(400).json({ error: 'Photo already submitted for this task' });
    }
    if (submission.status === 'blocked') {
      return res.status(403).json({ error: 'This submission has been blocked by an admin. You cannot re-upload.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const now = new Date();
    const elapsedMs = now - submission.riddleOpenedAt;

    const uploadedTempPath = req.file.path;
    const ext = (path.extname(req.file.originalname) || '.jpg').toLowerCase();
    const originalFilename = `${crypto.randomUUID()}${ext}`;
    const originalPath = path.join(uploadsDir, originalFilename);
    await fs.rename(uploadedTempPath, originalPath);

    let blurredPath = null;
    try {
      blurredPath = await createBlurFromOriginal(originalPath);
    } catch (_err) {
      // Do not fail upload if blur generation fails; competitors will see "Photo hidden".
    }

    submission.photoSubmittedAt = now;
    submission.elapsedMs = elapsedMs;
    submission.photoUrl = toUploadUrlFromAbsolute(originalPath);
    submission.photoBlurUrl = blurredPath ? toUploadUrlFromAbsolute(blurredPath) : null;
    submission.cloudinaryId = originalFilename;
    submission.status = 'completed';
    await submission.save();

    const taskStats = await getTaskStats(submission.task);

    res.json({
      message: 'Photo submitted!',
      submission: {
        id: submission._id,
        elapsedMs: submission.elapsedMs,
        photoUrl: fullUrl(req, submission.photoUrl),
        status: submission.status,
        photoEndpoint: `/submissions/${submission._id}/photo`,
      },
      taskStats,
    });
  } catch (err) {
    next(err);
  }
});

// Photo feed – all teams are visible; non-owner photos are blurred server-side.
router.get('/feed', auth, async (req, res, next) => {
  try {
    const baseFilter = {
      status: 'completed',
      photoUrl: { $ne: null },
      blockedAt: null,
    };

    const filter = { ...baseFilter };
    if (req.query.teamId) filter.team = req.query.teamId;
    if (req.query.taskId) filter.task = req.query.taskId;

    const [feed, allTeamIds, allTaskIds] = await Promise.all([
      Submission.find(filter)
        .populate('team', 'name avatarColor')
        .populate('task', 'title locationHint')
        .sort('-photoSubmittedAt')
        .limit(100)
        .lean(),
      Submission.distinct('team', baseFilter),
      Submission.distinct('task', baseFilter),
    ]);

    const [teamOptions, taskOptions] = await Promise.all([
      Team.find({ _id: { $in: allTeamIds } }).select('name').sort('name').lean(),
      Task.find({ _id: { $in: allTaskIds } }).select('title order').sort('order').lean(),
    ]);

    const mapped = feed.map((s) => {
      const isOwner = String(s.team?._id) === String(req.teamId);

      return {
        ...s,
        isOwner,
        isBlurred: !isOwner,
        photoUrl: null,
        photoEndpoint: `/submissions/${s._id}/photo`,
      };
    });

    res.json({
      items: mapped,
      filters: {
        teams: teamOptions.map((t) => ({ id: String(t._id), name: t.name })),
        tasks: taskOptions.map((t) => ({ id: String(t._id), title: t.title })),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Side Quest Gallery ────────────────────────────────────────
router.get('/gallery', auth, async (req, res, next) => {
  try {
    const filter = {
      status: 'completed',
      photoUrl: { $ne: null },
      blockedAt: null,
    };

    if (req.query.taskId) {
      filter.task = req.query.taskId;
    }

    // Pobierz bez sortowania po populate — posortujemy w JS
    const submissions = await Submission.find(filter)
      .populate('team', 'name avatarColor')
      .populate('task', 'title locationHint order')
      .sort('-photoSubmittedAt')   // ← tylko po dacie, bez task.order (nie działa w Mongoose)
      .limit(200)
      .lean();

    // Sortuj po task.order w JS
    submissions.sort((a, b) => (a.task?.order ?? 999) - (b.task?.order ?? 999));

    res.json(submissions.map((s) => ({ ...s, photoUrl: fullUrl(req, s.photoUrl) })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
