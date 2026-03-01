// ──────────────────────────────────────────────────────────────
// Submission routes – photo upload, feed & gallery
// ──────────────────────────────────────────────────────────────
const router = require('express').Router();
const Submission = require('../models/Submission');
const auth = require('../middleware/auth');
const { upload } = require('../config/upload');
const fullUrl = require('../utils/fullUrl');

// ★ Upload photo – STOPS the server-side timer
router.post('/:taskId/upload', auth, upload.single('photo'), async (req, res, next) => {
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

    submission.photoSubmittedAt = now;
    submission.elapsedMs = elapsedMs;
    submission.photoUrl = `/uploads/${req.file.filename}`;
    submission.cloudinaryId = req.file.filename;
    submission.status = 'completed';
    await submission.save();

    res.json({
      message: 'Photo submitted!',
      submission: {
        id: submission._id,
        elapsedMs: submission.elapsedMs,
        photoUrl: fullUrl(req, submission.photoUrl),
        status: submission.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Photo feed – teams see ONLY their own photos (not other teams')
router.get('/feed', auth, async (req, res, next) => {
  try {
    const feed = await Submission.find({
      team: req.teamId,
      status: 'completed',
      photoUrl: { $ne: null },
      blockedAt: null,
    })
      .populate('team', 'name avatarColor')
      .populate('task', 'title locationHint')
      .sort('-photoSubmittedAt')
      .limit(100)
      .lean();

    res.json(feed.map((s) => ({ ...s, photoUrl: fullUrl(req, s.photoUrl) })));
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
