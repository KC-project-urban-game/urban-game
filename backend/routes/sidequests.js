// ─────────────────────���────────────────────────────────────────
// SideQuest routes (team-facing)
// GET  /api/sidequests           → list all active sidequests
// GET  /api/sidequests/gallery   → all sidequest photos (gallery)
// POST /api/sidequests/:id/submit → upload photo & mark done
// ──────────────────────────────────────────────────────────────
const router = require('express').Router();
const SideQuest = require('../models/SideQuest');
const SideQuestSubmission = require('../models/SideQuestSubmission');
const auth = require('../middleware/auth');
const gameActive = require('../middleware/gameActive');
const { upload } = require('../config/upload');
const fullUrl = require('../utils/fullUrl');

// List all active sidequests + attach team completion & review status + summary
router.get('/', auth, async (req, res, next) => {
  try {
    const quests = await SideQuest.find({ isActive: true }).sort('createdAt').lean();

    const submissions = await SideQuestSubmission.find({ team: req.teamId }).lean();
    const subMap = {};
    submissions.forEach((s) => { subMap[s.sideQuest.toString()] = s; });

    const enriched = quests.map((q) => {
      const sub = subMap[q._id.toString()];
      return {
        ...q,
        submitted: !!sub,
        status: sub?.status || null,
        photoUrl: fullUrl(req, sub?.photoUrl || null),
      };
    });

    const submitted = submissions.length;
    const approved  = submissions.filter((s) => s.status === 'approved').length;
    const rejected  = submissions.filter((s) => s.status === 'rejected').length;
    const pending   = submissions.filter((s) => s.status === 'pending').length;

    res.json({ quests: enriched, summary: { submitted, approved, rejected, pending } });
  } catch (err) {
    next(err);
  }
});

// ── Side Quest Gallery ────────────────────────────────────────
// GET /api/sidequests/gallery?questId=<id>
// Zwraca zdjęcia side questów z informacją o teamie i questcie
router.get('/gallery', auth, async (req, res, next) => {
  try {
    const filter = { photoUrl: { $ne: null }, status: {$ne: 'rejected'}, };
    if (req.query.questId) filter.sideQuest = req.query.questId;

    const submissions = await SideQuestSubmission.find(filter)
      .populate('team', 'name avatarColor')
      .populate('sideQuest', 'title description')
      .sort('-createdAt')
      .limit(200)
      .lean();

    res.json(submissions.map((s) => ({ ...s, photoUrl: fullUrl(req, s.photoUrl) })));
  } catch (err) {
    next(err);
  }
});

// Submit photo for a sidequest
router.post('/:id/submit', auth, gameActive, upload.single('photo'), async (req, res, next) => {
  try {
    const quest = await SideQuest.findById(req.params.id);
    if (!quest) return res.status(404).json({ error: 'SideQuest not found' });
    if (!quest.isActive) return res.status(400).json({ error: 'This sidequest is not active' });

    const existing = await SideQuestSubmission.findOne({
      team: req.teamId,
      sideQuest: quest._id,
    });
    if (existing) {
      return res.status(400).json({ error: 'Already submitted for this sidequest' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    const submission = await SideQuestSubmission.create({
      team: req.teamId,
      sideQuest: quest._id,
      photoUrl: `/uploads/${req.file.filename}`,
      status: 'pending',
    });

    res.json({
      message: 'SideQuest completed!',
      submission: {
        id: submission._id,
        photoUrl: fullUrl(req, submission.photoUrl),
        status: submission.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
