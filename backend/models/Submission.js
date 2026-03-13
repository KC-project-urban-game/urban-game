// ──────────────────────────────────────────────────────────────
// Submission model – links a team, task, photo, and timing data
// ──────────────────────────────────────────────────────────────
const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },

    // ── Timer fields (server-authoritative) ─────────────────
    riddleOpenedAt: { type: Date, required: true },   // set when GET /tasks/:id
    photoSubmittedAt: { type: Date },                  // set on upload
    elapsedMs: { type: Number },                       // diff in milliseconds

    // ── Photo ───────────────────────────────────────────────
    photoUrl: { type: String },
    photoBlurUrl: { type: String },
    cloudinaryId: { type: String },

    status: {
      type: String,
      enum: ['in-progress', 'completed', 'blocked'],
      default: 'in-progress',
    },

    // ── Admin moderation ────────────────────────────────────
    blockedAt: { type: Date, default: null },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    blockReason: { type: String, default: '' },

    // ── Admin photo scoring ─────────────────────────────────
    photoPoints: { type: Number, default: null },  // null = not yet scored
    scoredAt: { type: Date, default: null },
    scoredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
  },
  { timestamps: true }
);

// Compound index – one active submission per team per task
submissionSchema.index({ team: 1, task: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
