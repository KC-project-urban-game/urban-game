// ──────────────────────────────────────────────────────────────
// Public Game Config route – returns non-sensitive settings
// GET /api/config
// ──────────────────────────────────────────────────────────────
const router = require('express').Router();
const GameConfig = require('../models/GameConfig');
const { getEffectiveGameState } = require('../utils/gameState');

router.get('/', async (_req, res, next) => {
  try {
    const config = await GameConfig.getConfig();
    const effectiveState = getEffectiveGameState(config);
    res.json({
      gameTitle: config.gameTitle,
      gameSubtitle: config.gameSubtitle,
      gameActive: effectiveState.active,
      gameActiveManual: config.gameActive,
      gameInactiveReason: effectiveState.active ? null : effectiveState.reason,
      gameEndedBy: effectiveState.endedBy,
      mapCenterLat: config.mapCenterLat,
      mapCenterLng: config.mapCenterLng,
      mapZoom: config.mapZoom,
      allowRegistration: config.allowRegistration,
      leaderboardMode: config.leaderboardMode,
      hintRevealDelaySec: config.hintRevealDelaySec,
      locationRevealDelaySec: config.locationRevealDelaySec,
      boundaryRadiusMeters: config.boundaryRadiusMeters,
      gameEndTime: config.gameEndTime,
      gameDurationMinutes: config.gameDurationMinutes,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
