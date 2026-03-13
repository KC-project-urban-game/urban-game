const GameConfig = require('../models/GameConfig');
const { getEffectiveGameState } = require('../utils/gameState');

module.exports = async function gameActive(req, res, next) {
  try {
    // Admin users can always access endpoints guarded by this middleware.
    if (req.role === 'admin') return next();

    const config = await GameConfig.getConfig();
    const state = getEffectiveGameState(config);
    if (!state.active) {
      return res.status(403).json({
        error: state.reason || 'Game is not active',
        gameActive: false,
        endedBy: state.endedBy,
      });
    }

    return next();
  } catch (err) {
    return next(err);
  }
};
