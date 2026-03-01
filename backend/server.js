// ──────────────────────────────────────────────────────────────
// Scavenger Hunt API – Main Entry Point
// ──────────────────────────────────────────────────────────────
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
const maxRequestSize = process.env.MAX_REQUEST_SIZE_MB ? `${process.env.MAX_REQUEST_SIZE_MB}mb` : '10mb';
app.use(express.json({ limit: maxRequestSize }));
app.use(express.urlencoded({ extended: true, limit: maxRequestSize }));

// ── Database ─────────────────────────────────────────────────
const dbName = process.env.DB_NAME || 'scavenger-hunt';
const mongoUri =
  process.env.MONGODB_URI ||
  process.env.AZURE_COSMOS_CONNECTIONSTRING ||
  `mongodb://localhost:27017/${dbName}`;

mongoose
  .connect(mongoUri)
  .then(async () => {
    console.log('✅  MongoDB connected');
    await autoSeed();
  })
  .catch((err) => {
    console.error('❌  MongoDB connection error:', err.message);
    process.exit(1);
  });

// ── Auto-seed ────────────────────────────────────────────────
async function autoSeed() {
  const Task = require('./models/Task');
  const Team = require('./models/Team');
  const GameConfig = require('./models/GameConfig');

  const taskCount = await Task.countDocuments();
  const adminExists = await Team.findOne({ role: 'admin' });

  if (taskCount === 0) {
    const TASKS = [
      { title: 'The Welcome Arch', description: 'Find the grand entrance where every attendee begins their journey.', locationHint: 'Near the main entrance / registration area', detailedHint: "It's right behind the badge pick-up desks — look up!", points: 100, order: 1, lat: 52.2297, lng: 21.0122, mapLabel: '1' },
      { title: 'The Innovation Wall', description: 'Somewhere in the venue, sponsors have left their mark on a massive display.', locationHint: 'Main hall / exhibition area', detailedHint: 'Check the corridor between Hall A and Hall B.', points: 100, order: 2, lat: 52.2299, lng: 21.0126, mapLabel: '2' },
      { title: 'The Hidden Garden', description: 'Not everything at this conference is indoors.', locationHint: 'Outdoor / terrace area', detailedHint: 'Follow the signs to the "Chill Zone" on level 0.', points: 150, order: 3, lat: 52.2294, lng: 21.0118, mapLabel: '3' },
      { title: "The Speaker's Podium", description: 'Every great idea starts on a stage.', locationHint: 'Main auditorium', detailedHint: "It's the largest room in the venue — follow the crowd!", points: 100, order: 4, lat: 52.2301, lng: 21.0130, mapLabel: '4' },
      { title: 'The Coffee Oracle', description: "Legend says there's a barista here who knows the future of tech.", locationHint: 'Food & beverage area', detailedHint: 'Level 1, next to the workshop rooms. Look for the longest queue.', points: 100, order: 5, lat: 52.2295, lng: 21.0128, mapLabel: '5' },
      { title: 'The Secret QR Code', description: 'Hidden in plain sight — a QR code has been placed somewhere unusual.', locationHint: 'Could be anywhere!', detailedHint: 'Check the bathroom mirrors... yes, really.', points: 200, order: 6, lat: 52.2298, lng: 21.0115, mapLabel: '6' },
      { title: 'Team Spirit', description: 'Gather ALL your team members and take a group photo.', locationHint: 'Registration / info desk area', detailedHint: 'The mascot standee is next to the info booth near entrance B.', points: 150, order: 7, lat: 52.2292, lng: 21.0124, mapLabel: '7' },
      { title: 'The Vintage Corner', description: 'Somewhere in this modern venue, a piece of computing history is on display.', locationHint: 'Exhibition / sponsor booths', detailedHint: 'Booth #42 — "The Museum of Code" pop-up.', points: 150, order: 8, lat: 52.2303, lng: 21.0120, mapLabel: '8' },
    ];
    await Task.insertMany(TASKS);
    console.log('🌱  Auto-seeded 8 tasks');
  }

  if (!adminExists) {
    const adminName = process.env.DEFAULT_ADMIN_NAME || 'admin';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin2026';
    await Team.create({ name: adminName, password: adminPassword, role: 'admin', avatarColor: '#ffd700' });
    console.log(`🔐  Auto-created admin account  (name: "${adminName}", password: "${adminPassword}")`);
  }

  const configExists = await GameConfig.findOne();
  if (!configExists) {
    await GameConfig.create({
      defaultTaskPoints: 100, timeBonusThresholdSec: 120, timeBonusPoints: 50,
      hintPenaltyPoints: 0, leaderboardMode: 'most-tasks', gameActive: true,
      gameTitle: 'Scavenger Hunt 2026', gameSubtitle: 'Conference Edition',
      mapCenterLat: 52.2297, mapCenterLng: 21.0122, mapZoom: 17,
      allowRegistration: true, shuffleTaskOrder: true,
    });
    console.log('⚙️   Auto-initialized game config');
  }
}

// ── Static files ──────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/submissions', require('./routes/submissions'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/sidequests', require('./routes/sidequests'));
app.use('/api/config', require('./routes/gameConfig'));

// Root API info
app.get('/api', (_req, res) => res.json({
  app: 'Scavenger Hunt API',
  version: '1.0.0',
  endpoints: [
    'GET  /api/health',
    'POST /api/auth/login',
    'GET  /api/tasks',
    'GET  /api/config',
    'GET  /api/leaderboard',
  ],
}));

// Health-check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ── Error handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';
  res.status(status).json({ error: message });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(` API running on port ${PORT}`));
