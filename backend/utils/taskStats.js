const Submission = require('../models/Submission');

async function getTaskStats(taskId) {
  const [completedCount, activeCount] = await Promise.all([
    Submission.countDocuments({ task: taskId, status: 'completed', blockedAt: null }),
    Submission.countDocuments({ task: taskId, status: 'in-progress' }),
  ]);

  return {
    completedCount,
    activeCount,
  };
}

module.exports = { getTaskStats };