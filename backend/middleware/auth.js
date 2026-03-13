// ──────────────────────────────────────────────────────────────
// JWT Authentication Middleware
// Verifies the Bearer token and attaches teamId + role to req
// ──────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const Team = require('../models/Team');

module.exports = async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const team = await Team.findById(decoded.teamId).select('name role').lean();
    if (!team) {
      return res.status(401).json({ error: 'Account no longer exists. Please log in again.' });
    }

    req.teamId = decoded.teamId;
    req.teamName = team.name;
    req.role = team.role || 'team';
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
