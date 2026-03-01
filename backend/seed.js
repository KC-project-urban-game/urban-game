// ──────────────────────────────────────────────────────────────
// Seed script – populates the database with sample tasks,
// creates admin account, and initializes game config
// Run:  npm run seed   (or:  node seed.js)
// ──────────────────────────────────────────────────────────────
require('dotenv').config();
const mongoose = require('mongoose');
const Task = require('./models/Task');
const Team = require('./models/Team');
const GameConfig = require('./models/GameConfig');

// ★ EASY TO MODIFY: Change tasks, coordinates, points here
// Coordinates below are sample points around a conference venue
// Update lat/lng to match YOUR actual venue location
const TASKS = [
  {
    title: 'The Welcome Arch',
    description:
      'Find the grand entrance where every attendee begins their journey. Look for the structure that frames the first impression of the conference.',
    locationHint: 'Near the main entrance / registration area',
    detailedHint: "It's right behind the badge pick-up desks — look up!",
    points: 100,
    order: 1,
    lat: 52.2297,
    lng: 21.0122,
    mapLabel: '1',
  },
  {
    title: 'The Innovation Wall',
    description:
      'Somewhere in the venue, sponsors have left their mark on a massive display. Find the wall covered in logos and futuristic graphics.',
    locationHint: 'Main hall / exhibition area',
    detailedHint: 'Check the corridor between Hall A and Hall B.',
    points: 100,
    order: 2,
    lat: 52.2299,
    lng: 21.0126,
    mapLabel: '2',
  },
  {
    title: 'The Hidden Garden',
    description:
      'Not everything at this conference is indoors. Find the outdoor space where attendees go to recharge — nature meets networking.',
    locationHint: 'Outdoor / terrace area',
    detailedHint: 'Follow the signs to the "Chill Zone" on level 0.',
    points: 150,
    order: 3,
    lat: 52.2294,
    lng: 21.0118,
    mapLabel: '3',
  },
  {
    title: "The Speaker's Podium",
    description:
      'Every great idea starts on a stage. Find the main keynote stage and snap a photo of the podium before the next talk begins.',
    locationHint: 'Main auditorium',
    detailedHint: "It's the largest room in the venue — follow the crowd!",
    points: 100,
    order: 4,
    lat: 52.2301,
    lng: 21.0130,
    mapLabel: '4',
  },
  {
    title: 'The Coffee Oracle',
    description:
      "Legend says there's a barista here who knows the future of tech. Find the best coffee spot in the venue and capture the moment.",
    locationHint: 'Food & beverage area',
    detailedHint: 'Level 1, next to the workshop rooms. Look for the longest queue.',
    points: 100,
    order: 5,
    lat: 52.2295,
    lng: 21.0128,
    mapLabel: '5',
  },
  {
    title: 'The Secret QR Code',
    description:
      "Hidden in plain sight — a QR code has been placed somewhere unusual. Find it, scan it, and take a selfie with it.",
    locationHint: 'Could be anywhere!',
    detailedHint: 'Check the bathroom mirrors... yes, really.',
    points: 200,
    order: 6,
    lat: 52.2298,
    lng: 21.0115,
    mapLabel: '6',
  },
  {
    title: 'Team Spirit',
    description:
      'Gather ALL your team members, find the conference mascot (or mascot poster), and take a group photo together.',
    locationHint: 'Registration / info desk area',
    detailedHint: 'The mascot standee is next to the info booth near entrance B.',
    points: 150,
    order: 7,
    lat: 52.2292,
    lng: 21.0124,
    mapLabel: '7',
  },
  {
    title: 'The Vintage Corner',
    description:
      'Somewhere in this modern venue, a piece of computing history is on display. Find the retro tech exhibit and photograph it.',
    locationHint: 'Exhibition / sponsor booths',
    detailedHint: 'Booth #42 — "The Museum of Code" pop-up.',
    points: 150,
    order: 8,
    lat: 52.2303,
    lng: 21.0120,
    mapLabel: '8',
  },
];

// ★ Admin credentials – set via environment variables or use defaults
const ADMIN = {
  name: process.env.DEFAULT_ADMIN_NAME || 'admin',
  password: process.env.DEFAULT_ADMIN_PASSWORD || 'admin2026',
  role: 'admin',
  avatarColor: '#ffd700',
};

// ★ Default game configuration – customize for your event
const CONFIG = {
  defaultTaskPoints: 100,
  timeBonusThresholdSec: 120,
  timeBonusPoints: 50,
  hintPenaltyPoints: 0,
  leaderboardMode: 'most-tasks',
  gameActive: true,
  gameTitle: 'Scavenger Hunt 2026',
  gameSubtitle: 'Conference Edition',
  mapCenterLat: 52.2297,    // ← Set to YOUR venue latitude
  mapCenterLng: 21.0122,    // ← Set to YOUR venue longitude
  mapZoom: 17,
  allowRegistration: true,
  shuffleTaskOrder: true,
};

async function seed() {
  try {
    const dbName = process.env.DB_NAME || 'scavenger-hunt';
    const mongoUri = process.env.MONGODB_URI || `mongodb://localhost:27017/${dbName}`;
    await mongoose.connect(mongoUri);
    console.log('✅  Connected to MongoDB');

    // Seed tasks
    await Task.deleteMany({});
    console.log('🗑️   Cleared existing tasks');
    await Task.insertMany(TASKS);
    console.log(`🌱  Seeded ${TASKS.length} tasks`);

    // Create admin account (if not exists)
    const existingAdmin = await Team.findOne({ role: 'admin' });
    if (!existingAdmin) {
      await Team.create(ADMIN);
      console.log(`🔐  Admin account created (name: "${ADMIN.name}")`);
    } else {
      console.log('ℹ️   Admin account already exists, skipping');
    }

    // Initialize game config
    const existingConfig = await GameConfig.findOne();
    if (!existingConfig) {
      await GameConfig.create(CONFIG);
      console.log('⚙️   Game config initialized');
    } else {
      // Update existing config with defaults for any new fields
      Object.keys(CONFIG).forEach((key) => {
        if (existingConfig[key] === undefined) {
          existingConfig[key] = CONFIG[key];
        }
      });
      await existingConfig.save();
      console.log('⚙️   Game config updated');
    }

    await mongoose.disconnect();
    console.log('✅  Done – seed complete!');
    console.log('');
    console.log('📋  Quick reference:');
    console.log(`    Admin login:  name="${ADMIN.name}"  password="${ADMIN.password}"`);
    console.log(`    Tasks seeded: ${TASKS.length}`);
    console.log(`    Map center:   ${CONFIG.mapCenterLat}, ${CONFIG.mapCenterLng}`);
  } catch (err) {
    console.error('❌  Seed error:', err);
    process.exit(1);
  }
}

seed();
