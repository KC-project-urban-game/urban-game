// ──────────────────────────────────────────────────────────────
// Auth routes – register & login (team-based, simple)
// Includes admin account creation via ADMIN_SETUP_KEY
// ──────────────────────────────────────────────────────────────
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const Team = require('../models/Team');
const Task = require('../models/Task');
const GameConfig = require('../models/GameConfig');
const auth = require('../middleware/auth');

const signToken = (team) =>
  jwt.sign(
    { teamId: team._id, teamName: team.name, role: team.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

// ── Helper: generate shuffled task queue for a new team ──────
async function generateTaskQueue() {
  const config = await GameConfig.getConfig();
  const tasks = await Task.find({ isActive: true }).select('_id order').sort('order');
  const ids = tasks.map((t) => t._id);

  if (config.shuffleTaskOrder) {
    // Fisher-Yates shuffle
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  return ids;
}

// POST /api/auth/register – DISABLED (admin creates teams via /api/admin/teams)
router.post('/register', async (_req, res) => {
  return res.status(403).json({ error: 'Self-registration is disabled. Ask the admin to create your team.' });
});

// PUT /api/auth/profile – one-time team profile edit (name + password)
router.put('/profile', auth, async (req, res, next) => {
  try {
    const team = await Team.findById(req.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
  if (team.role === 'admin') return res.status(403).json({ error: 'Admin cannot edit profile this way' });

    const { name, password } = req.body;
    if (!name && !password) {
      return res.status(400).json({ error: 'Provide name or password to update' });
    }

    if (name && name !== team.name) {
      // If the profile was already edited (including via the first-login dialog),
      // disallow changing the team name again.
      if (team.profileEdited) return res.status(403).json({ error: 'Team name cannot be changed' });
      const exists = await Team.findOne({ name });
      if (exists) return res.status(409).json({ error: 'Team name already taken' });
      team.name = name;
    }
    if (password) {
      if (team.passwordEdited) return res.status(403).json({ error: 'Password can only be changed once' });
      if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
      team.password = password; // pre-save hook will hash it
      team.passwordEdited = true;
      team.originalPassword = null; // clear plaintext password on password change
    }

    team.profileEdited = true;
    await team.save();

    const token = signToken(team);
    res.json({
      token,
      team: {
        id: team._id,
        name: team.name,
        avatarColor: team.avatarColor,
        role: team.role,
        profileEdited: team.profileEdited,
        passwordEdited: team.passwordEdited || false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const team = await Team.findOne({ name });
    if (!team) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await team.comparePassword(password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(team);
    res.json({
      token,
      team: {
        id: team._id,
        name: team.name,
        avatarColor: team.avatarColor,
        role: team.role,
        profileEdited: team.profileEdited || false,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/admin-setup
// ★ Create the admin account using a secret key (one-time setup)
// Body: { name, password, setupKey }
router.post('/admin-setup', async (req, res, next) => {
  try {
    const { name, password, setupKey } = req.body;

    if (!setupKey || setupKey !== process.env.ADMIN_SETUP_KEY) {
      return res.status(403).json({ error: 'Invalid setup key' });
    }
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password are required' });
    }

    // Check if admin already exists
    const existingAdmin = await Team.findOne({ role: 'admin' });
    if (existingAdmin) {
      return res.status(409).json({ error: 'Admin account already exists. Use login.' });
    }

    const admin = await Team.create({
      name,
      password,
      role: 'admin',
      avatarColor: '#ffd700',
    });
    const token = signToken(admin);

    res.status(201).json({
      token,
      team: {
        id: admin._id,
        name: admin.name,
        avatarColor: admin.avatarColor,
        role: admin.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/name – update current team's name (authenticated)
router.put('/name', auth, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    const trimmed = String(name).trim();

    // Check uniqueness
    const existing = await Team.findOne({ name: trimmed });
    if (existing && String(existing._id) !== String(req.teamId)) {
      return res.status(409).json({ error: 'Team name already taken' });
    }

    const team = await Team.findById(req.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

  team.name = trimmed;
  // mark that profile was edited via the dialog
  team.profileEdited = true;
  team.originalPassword = null;
  await team.save();

  // issue a refreshed token with the new name embedded
  const token = signToken(team);

  res.json({ token, team: { id: team._id, name: team.name, avatarColor: team.avatarColor, role: team.role, profileEdited: team.profileEdited } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

