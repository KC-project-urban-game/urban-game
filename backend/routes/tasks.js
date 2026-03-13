// ──────────────────────────────────────────────────────────────
// Task routes
// GET  /api/tasks          → list tasks in team's queue order
// GET  /api/tasks/:id      → view task details (no timer start)
// POST /api/tasks/:id/start → explicitly START the timer ★
// ──────────────────────────────────────────────────────────────
const router = require('express').Router();
const Task = require('../models/Task');
const Team = require('../models/Team');
const Submission = require('../models/Submission');
const GameConfig = require('../models/GameConfig');
const auth = require('../middleware/auth');
const gameActive = require('../middleware/gameActive');
const fullUrl = require('../utils/fullUrl');
const { getTaskStats } = require('../utils/taskStats');

// List all active tasks in this team's queue order
router.get('/', auth, async (req, res, next) => {
  try {
    const team = await Team.findById(req.teamId);
    const allTasks = await Task.find({ isActive: true })
      .select('title locationHint points order lat lng mapLabel')
      .lean();

    // Build a map of tasks by ID
    const taskMap = {};
    allTasks.forEach((t) => { taskMap[t._id.toString()] = t; });

    // Attach the team's submission status for each task
    const submissions = await Submission.find({ team: req.teamId }).lean();
    const subMap = {};
    submissions.forEach((s) => { subMap[s.task.toString()] = s; });

    // If team has a taskQueue, use that order; otherwise fall back to default order
    let orderedTasks;
    if (team && team.taskQueue && team.taskQueue.length > 0) {
      orderedTasks = team.taskQueue
        .map((id) => taskMap[id.toString()])
        .filter(Boolean); // filter out any removed tasks

      // Add any new tasks not in the queue yet
      const queueSet = new Set(team.taskQueue.map((id) => id.toString()));
      const newTasks = allTasks.filter((t) => !queueSet.has(t._id.toString()));
      orderedTasks = orderedTasks.concat(newTasks);
    } else {
      orderedTasks = allTasks.sort((a, b) => a.order - b.order);
    }

    const config = await GameConfig.getConfig();
    const locDelay = (config.locationRevealDelaySec || 360) * 1000;

    const enriched = orderedTasks.map((t, index) => {
      const sub = subMap[t._id.toString()];
      const taskObj = { ...t };

      // Teams should NOT see lat/lng until the location reveal delay has passed
      if (req.role !== 'admin') {
        const started = sub?.riddleOpenedAt;
        const locationRevealed = started && (Date.now() - new Date(started).getTime() >= locDelay);
        if (!locationRevealed) {
          delete taskObj.lat;
          delete taskObj.lng;
        }
      }

      return {
        ...taskObj,
        queuePosition: index + 1,  // team-specific order number
        status: sub ? sub.status : 'not-started',
        elapsedMs: sub?.elapsedMs || null,
        riddleOpenedAt: sub?.riddleOpenedAt || null,
      };
    });

    res.json(enriched);
  } catch (err) {
    next(err);
  }
});

// View a single task detail – does NOT start the timer
router.get('/:id', auth, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Check if there's an existing submission
    const submission = await Submission.findOne({
      team: req.teamId,
      task: task._id,
    });

    const config = await GameConfig.getConfig();
    const locDelay = (config.locationRevealDelaySec || 360) * 1000;
    const taskObj = task.toObject();
    const taskStats = await getTaskStats(task._id);

    // Strip location for teams until the reveal delay has passed
    if (req.role !== 'admin') {
      const started = submission?.riddleOpenedAt;
      const locationRevealed = started && (Date.now() - new Date(started).getTime() >= locDelay);
      if (!locationRevealed) {
        delete taskObj.lat;
        delete taskObj.lng;
      }
    }

    res.json({
      task: taskObj,
      taskStats,
      submission: submission
        ? {
            id: submission._id,
            riddleOpenedAt: submission.riddleOpenedAt,
            status: submission.status,
            elapsedMs: submission.elapsedMs,
            photoUrl: fullUrl(req, submission.photoUrl),
            photoEndpoint: submission.photoUrl ? `/submissions/${submission._id}/photo` : null,
          }
        : null, // null means task hasn't been started yet
    });
  } catch (err) {
    next(err);
  }
});

// ★ START the task – creates the submission and starts the server-side timer
// POST /api/tasks/:id/start
router.post('/:id/start', auth, gameActive, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Check if already started
    let submission = await Submission.findOne({
      team: req.teamId,
      task: task._id,
    });

    if (submission) {
      // Already started – just return current state
      const taskObj = task.toObject();
      const taskStats = await getTaskStats(task._id);
      if (req.role !== 'admin') {
        const cfg = await GameConfig.getConfig();
        const delay = (cfg.locationRevealDelaySec || 360) * 1000;
        const revealed = submission.riddleOpenedAt && (Date.now() - new Date(submission.riddleOpenedAt).getTime() >= delay);
        if (!revealed) { delete taskObj.lat; delete taskObj.lng; }
      }
      return res.json({
        task: taskObj,
        taskStats,
        submission: {
          id: submission._id,
          riddleOpenedAt: submission.riddleOpenedAt,
          status: submission.status,
          elapsedMs: submission.elapsedMs,
          photoUrl: fullUrl(req, submission.photoUrl),
          photoEndpoint: submission.photoUrl ? `/submissions/${submission._id}/photo` : null,
        },
      });
    }

    // Create new submission – THIS STARTS THE TIMER
    submission = await Submission.create({
      team: req.teamId,
      task: task._id,
      riddleOpenedAt: new Date(),
    });

    const newTaskObj = task.toObject();
    // Brand new start – location is never revealed at time 0
    if (req.role !== 'admin') {
      delete newTaskObj.lat;
      delete newTaskObj.lng;
    }

    const taskStats = await getTaskStats(task._id);

    res.status(201).json({
      task: newTaskObj,
      taskStats,
      submission: {
        id: submission._id,
        riddleOpenedAt: submission.riddleOpenedAt,
        status: submission.status,
        elapsedMs: null,
        photoUrl: null,
        photoEndpoint: null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
