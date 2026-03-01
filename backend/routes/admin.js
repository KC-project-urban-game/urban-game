// ──────────────────────────────────────────────────────────────
// Admin routes – full CRUD for tasks, photo moderation, config
// All routes require auth + admin role
// ──────────────────────────────────────────────────────────────
const router = require('express').Router();
const auth = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');
const Task = require('../models/Task');
const Team = require('../models/Team');
const Submission = require('../models/Submission');
const GameConfig = require('../models/GameConfig');
const SideQuest = require('../models/SideQuest');
const SideQuestSubmission = require('../models/SideQuestSubmission');
const fs = require('fs');
const path = require('path');
const fullUrl = require('../utils/fullUrl');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');

// Apply auth + admin to all routes in this file
router.use(auth, adminOnly);

// ══════════════════════════════════════════════════════════════
// ██ GAME CONFIG
// ══════════════════════════════════════════════════════════════

// GET /api/admin/config – get current game configuration
router.get('/config', async (_req, res, next) => {
  try {
    const config = await GameConfig.getConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/config – update game configuration
// ★ EASY TO MODIFY: Change points, time bonuses, map center, etc.
router.put('/config', async (req, res, next) => {
  try {
    const config = await GameConfig.getConfig();
    const allowedFields = [
      'defaultTaskPoints',
      'timeBonusThresholdSec',
      'timeBonusPoints',
      'hintPenaltyPoints',
      'leaderboardMode',
      'gameActive',
      'gameTitle',
      'gameSubtitle',
      'mapCenterLat',
      'mapCenterLng',
      'mapZoom',
      'allowRegistration',
      'shuffleTaskOrder',
      'hintRevealDelaySec',
      'locationRevealDelaySec',
      'boundaryRadiusMeters',
      'gameEndTime',
      'gameDurationMinutes',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        config[field] = req.body[field];
      }
    });

    await config.save();
    res.json(config);
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// ██ TASKS MANAGEMENT
// ══════════════════════════════════════════════════════════════

// GET /api/admin/tasks – list ALL tasks (including inactive)
router.get('/tasks', async (_req, res, next) => {
  try {
    const tasks = await Task.find().sort('order');
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/tasks – create a new task
router.post('/tasks', async (req, res, next) => {
  try {
    const {
      title, description, locationHint, detailedHint,
      points, order, lat, lng, mapLabel, isActive,
    } = req.body;

    if (!title || !description || !locationHint) {
      return res.status(400).json({ error: 'title, description, and locationHint are required' });
    }

    const task = await Task.create({
      title,
      description,
      locationHint,
      detailedHint: detailedHint || '',
      points: points || 100,
      order: order || 0,
      lat: lat || null,
      lng: lng || null,
      mapLabel: mapLabel || '',
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/tasks/:id – update a task
router.put('/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const allowedFields = [
      'title', 'description', 'locationHint', 'detailedHint',
      'points', 'order', 'lat', 'lng', 'mapLabel', 'isActive',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    await task.save();
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/tasks/:id – delete a task
router.delete('/tasks/:id', async (req, res, next) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Also remove related submissions
    await Submission.deleteMany({ task: req.params.id });

    res.json({ message: 'Task deleted' });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// ██ PHOTO MODERATION
// ══════════════════════════════════════════════════════════════

// GET /api/admin/submissions – list all submissions with filters
router.get('/submissions', async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.taskId) filter.task = req.query.taskId;

    const submissions = await Submission.find(filter)
      .populate('team', 'name avatarColor')
      .populate('task', 'title locationHint order')
      .sort('-photoSubmittedAt')
      .lean();

    res.json(submissions.map((s) => ({ ...s, photoUrl: fullUrl(req, s.photoUrl) })));
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/submissions/:id/block – block a photo submission
router.put('/submissions/:id/block', async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    submission.status = 'blocked';
    submission.blockedAt = new Date();
    submission.blockedBy = req.teamId;
    submission.blockReason = req.body.reason || 'Blocked by admin';
    submission.photoPoints = 0;
    await submission.save();

    res.json({ message: 'Submission blocked', submission });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/submissions/:id/score – assign points to a photo submission
router.put('/submissions/:id/score', async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    const points = parseInt(req.body.points);
    if (isNaN(points) || points < 0) {
      return res.status(400).json({ error: 'Points must be a non-negative number' });
    }

    submission.photoPoints = points;
    submission.scoredAt = new Date();
    submission.scoredBy = req.teamId;
    await submission.save();

    res.json({ message: 'Photo scored', submission });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/submissions/:id/unblock – unblock a photo
router.put('/submissions/:id/unblock', async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    submission.status = 'completed';
    submission.blockedAt = null;
    submission.blockedBy = null;
    submission.blockReason = '';
    await submission.save();

    res.json({ message: 'Submission unblocked', submission });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/submissions/:id – delete the photo so team can re-upload
router.delete('/submissions/:id', async (req, res, next) => {
  try {
    const submission = await Submission.findById(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });

    // Delete the photo file from disk if it exists
    if (submission.photoUrl) {
      const filePath = path.join(__dirname, '..', submission.photoUrl);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Reset to in-progress so the team can re-upload (timer keeps running)
    submission.photoUrl = null;
    submission.cloudinaryId = null;
    submission.photoSubmittedAt = null;
    submission.elapsedMs = null;
    submission.status = 'in-progress';
    submission.photoPoints = null;
    submission.scoredAt = null;
    submission.scoredBy = null;
    submission.blockedAt = null;
    submission.blockedBy = null;
    submission.blockReason = '';
    await submission.save();

    res.json({ message: 'Photo deleted — team can re-upload' });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// ██ TEAMS MANAGEMENT
// ══════════════════════════════════════════════════════════════

// GET /api/admin/teams – list all teams (excluding admin)
router.get('/teams', async (_req, res, next) => {
  try {
    const teams = await Team.find({ role: { $ne: 'admin' } }).select('-password').sort('name');
    // Include originalPassword for non-edited teams
    res.json(teams);
  } catch (err) {
    next(err);
  }
});

// Helper: generate shuffled task queue for a new team
async function generateTaskQueueForNewTeam() {
  const config = await GameConfig.getConfig();
  const tasks = await Task.find({ isActive: true }).select('_id order').sort('order');
  const ids = tasks.map((t) => t._id);

  if (config.shuffleTaskOrder) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  return ids;
}

// POST /api/admin/teams – create one or multiple teams
// Body: { name } OR { teams: [{ name }, ...] }
router.post('/teams', async (req, res, next) => {
  try {
    const payload = req.body;
    const inputs = [];

    if (Array.isArray(payload?.teams)) {
      payload.teams.forEach((t) => {
        if (t && t.name) inputs.push({ name: String(t.name).trim() });
      });
    } else if (payload?.name) {
      inputs.push({ name: String(payload.name).trim() });
    }

    if (inputs.length === 0) return res.status(400).json({ error: 'No team names provided' });

    const created = [];
    const errors = [];

    for (const it of inputs) {
      const name = it.name;
      if (!name) {
        errors.push({ name, error: 'Empty name' });
        continue;
      }
      const exists = await Team.findOne({ name });
      if (exists) {
        errors.push({ name, error: 'Team name already exists' });
        continue;
      }

      // Generate 8-character alphanumeric password
      const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const bytes = crypto.randomBytes(8);
      let password = '';
      for (let i = 0; i < bytes.length; i++) {
        password += ALPHANUM[bytes[i] % ALPHANUM.length];
      }
      try {
        const taskQueue = await generateTaskQueueForNewTeam();
        const team = await Team.create({ name, password, taskQueue, originalPassword: password });
        created.push({ id: team._id, name: team.name, password });
      } catch (e) {
        // capture DB/validation errors per-team and continue
        errors.push({ name, error: e.message || 'Failed to create team' });
      }
    }

    if (created.length === 0) {
      return res.status(400).json({ error: 'No teams created', errors });
    }
    res.status(201).json({ created, errors });
  } catch (err) {
    next(err);
  }
});

// (Removed /teams/pdf endpoint — use /teams/generate and /teams/print instead)

// POST /api/admin/teams/generate – create N teams named team1..teamN
router.post('/teams/generate', async (req, res, next) => {
  try {
    const count = parseInt(req.body.count, 10);
    if (!count || count <= 0) return res.status(400).json({ error: 'Invalid count' });
    const created = [];
    const errors = [];

    // Find existing teams named team<number> and determine the highest index
    const existing = await Team.find({ name: { $regex: '^team\\d+$' } }).select('name').lean();
    let maxIndex = 0;
    for (const e of existing) {
      const m = e.name.match(/^team(\d+)$/);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!Number.isNaN(n) && n > maxIndex) maxIndex = n;
      }
    }

    // Start from next available index
    const startIndex = maxIndex + 1;

    for (let k = 0; k < count; k++) {
      const num = startIndex + k;
      const name = `team${num}`;
      const exists = await Team.findOne({ name });
      if (exists) {
        errors.push({ name, error: 'Team name already exists' });
        continue;
      }

      // generate password (8 alphanumeric)
      const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const bytes = crypto.randomBytes(8);
      let password = '';
      for (let b = 0; b < bytes.length; b++) password += ALPHANUM[bytes[b] % ALPHANUM.length];

      try {
        const taskQueue = await generateTaskQueueForNewTeam();
        const team = await Team.create({ name, password, taskQueue, originalPassword: password });
        created.push({ id: team._id, name: team.name, password });
      } catch (e) {
        errors.push({ name, error: e.message || 'Failed to create' });
      }
    }

    if (created.length === 0) return res.status(400).json({ error: 'No teams created', errors });
    res.status(201).json({ created, errors });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/teams/print – generate a printable PDF from provided entries [{name,password}, ...]
router.post('/teams/print', async (req, res, next) => {
  try {
    const entries = Array.isArray(req.body.entries) ? req.body.entries : null;
    if (!entries || entries.length === 0) return res.status(400).json({ error: 'No entries provided' });

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const buffers = [];
    doc.on('data', (d) => buffers.push(d));
    doc.on('end', () => {
      const pdfData = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="team-passwords.pdf"');
      res.send(pdfData);
    });

    // Title
    doc.fontSize(18).text('Team names & passwords', { align: 'center' });
    doc.moveDown(1);

    // Table layout
    const pageWidth = doc.page.width;
    const marginLeft = doc.page.margins.left;
    const marginRight = doc.page.margins.right;
    const usableWidth = pageWidth - marginLeft - marginRight;
    const nameColWidth = Math.floor(usableWidth * 0.7);
    const passColWidth = usableWidth - nameColWidth;
    const startX = marginLeft;

    // Header row
    const headerHeight = 28;
    let y = doc.y + 6;
    doc.rect(startX, y, usableWidth, headerHeight).fillAndStroke('#f3f4f6', '#e5e7eb');
    doc.fillColor('#111827').fontSize(12).text('Team Name', startX + 8, y + 8, { width: nameColWidth - 16, align: 'left' });
    doc.text('Password', startX + nameColWidth + 8, y + 8, { width: passColWidth - 16, align: 'left' });
    y += headerHeight;

    // Rows
    const rowHeight = 48; // generous spacing for cutting
    doc.fontSize(14).fillColor('#ffffff');
    entries.forEach((c, i) => {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.y;
      }

      // Draw cell borders
      doc.save();
      doc.rect(startX, y, nameColWidth, rowHeight).stroke('#d1d5db');
      doc.rect(startX + nameColWidth, y, passColWidth, rowHeight).stroke('#d1d5db');
      doc.restore();

      // Text with padding
      doc.fillColor('#111827').fontSize(13).text(c.name, startX + 8, y + 12, { width: nameColWidth - 16, align: 'left' });
      doc.text(c.password, startX + nameColWidth + 8, y + 12, { width: passColWidth - 16, align: 'left' });

      y += rowHeight;
    });

    doc.end();
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/teams/:id/reshuffle – generate new task queue for a team
router.put('/teams/:id/reshuffle', async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const tasks = await Task.find({ isActive: true }).select('_id order').sort('order');
    const ids = tasks.map((t) => t._id);

    // Fisher-Yates shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }

    team.taskQueue = ids;
    await team.save();

    res.json({ message: 'Task queue reshuffled', taskQueue: ids });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/teams/:id – delete a team and all their submissions
router.delete('/teams/:id', async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin account' });
    }

    await Submission.deleteMany({ team: req.params.id });
    await Team.findByIdAndDelete(req.params.id);

    res.json({ message: 'Team deleted' });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// ██ DASHBOARD STATS
// ══════════════════════════════════════════════════════════════

// GET /api/admin/stats – overview stats for admin dashboard
router.get('/stats', async (_req, res, next) => {
  try {
    const [teamCount, taskCount, submissionCount, completedCount, blockedCount] =
      await Promise.all([
        Team.countDocuments({ role: 'team' }),
        Task.countDocuments(),
        Submission.countDocuments(),
        Submission.countDocuments({ status: 'completed' }),
        Submission.countDocuments({ status: 'blocked' }),
      ]);

    res.json({
      teams: teamCount,
      tasks: taskCount,
      submissions: submissionCount,
      completed: completedCount,
      blocked: blockedCount,
      inProgress: submissionCount - completedCount - blockedCount,
    });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════
// ██ SIDEQUESTS MANAGEMENT
// ══════════════════════════════════════════════════════════════

// GET /api/admin/sidequests – list ALL sidequests (including inactive)
router.get('/sidequests', async (_req, res, next) => {
  try {
    const quests = await SideQuest.find().sort('createdAt').lean();
    res.json(quests);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/sidequests – create a new sidequest
router.post('/sidequests', async (req, res, next) => {
  try {
    const { title, description, isActive } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const quest = await SideQuest.create({
      title,
      description: description || '',
      isActive: isActive !== undefined ? isActive : true,
    });
    res.status(201).json(quest);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/sidequests/:id – update a sidequest
router.put('/sidequests/:id', async (req, res, next) => {
  try {
    const quest = await SideQuest.findById(req.params.id);
    if (!quest) return res.status(404).json({ error: 'SideQuest not found' });

    ['title', 'description', 'isActive'].forEach((f) => {
      if (req.body[f] !== undefined) quest[f] = req.body[f];
    });
    await quest.save();
    res.json(quest);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/sidequests/:id – delete a sidequest + its submissions
router.delete('/sidequests/:id', async (req, res, next) => {
  try {
    const quest = await SideQuest.findByIdAndDelete(req.params.id);
    if (!quest) return res.status(404).json({ error: 'SideQuest not found' });
    await SideQuestSubmission.deleteMany({ sideQuest: req.params.id });
    res.json({ message: 'SideQuest deleted' });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/sidequests/submissions – list sidequest submissions (filter: ?completed=true|false)
router.get('/sidequests/submissions', async (req, res, next) => {
  try {
    const filter = {};
    const submissions = await SideQuestSubmission.find(filter)
      .populate('team', 'name avatarColor')
      .populate('sideQuest', 'title description')
      .sort('-createdAt')
      .lean();
    res.json(submissions.map((s) => ({ ...s, photoUrl: fullUrl(req, s.photoUrl) })));
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/sidequests/submissions/:id/approve – approve a submission
router.put('/sidequests/submissions/:id/approve', async (req, res, next) => {
  try {
    const sub = await SideQuestSubmission.findById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    sub.status = 'approved';
    sub.reviewedBy = req.teamId;
    sub.reviewedAt = new Date();
    await sub.save();
    res.json({ message: 'Approved', submission: sub });
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/sidequests/submissions/:id/reject – reject a submission
router.put('/sidequests/submissions/:id/reject', async (req, res, next) => {
  try {
    const sub = await SideQuestSubmission.findById(req.params.id);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    sub.status = 'rejected';
    sub.reviewedBy = req.teamId;
    sub.reviewedAt = new Date();
    await sub.save();
    res.json({ message: 'Rejected', submission: sub });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
