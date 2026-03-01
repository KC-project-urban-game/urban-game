// ──────────────────────────────────────────────────────────────
// Team model – represents a participating team
// ──────────────────────────────────────────────────────────────
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 40,
    },
    password: {
      type: String,
      required: true,
      minlength: 4,
    },
    avatarColor: {
      type: String,
      default: '#00f0ff', // neon accent default
    },

    // ── Role: 'team' (default) or 'admin' ───────────────
    role: {
      type: String,
      enum: ['team', 'admin'],
      default: 'team',
    },

    // ── Each team gets a unique shuffled task order ──────
    // Array of Task ObjectIds in the order this team should complete them
    taskQueue: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],

    // ── Profile edit tracking ────────────────────────────
    // Teams can change name/password once. After that, this is true.
  profileEdited: { type: Boolean, default: false },
  // Teams may change their password once (separate from name change)
  passwordEdited: { type: Boolean, default: false },

    // ── Original auto-generated password (plaintext) ─────
    // Stored only for admin visibility; cleared when team edits profile.
    originalPassword: { type: String, default: null },
  },
  { timestamps: true }
);

// Hash password before saving
teamSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Instance method – verify password
teamSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Team', teamSchema);
