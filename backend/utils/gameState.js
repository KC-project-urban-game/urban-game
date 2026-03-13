function getEffectiveGameState(config, now = new Date()) {
  const result = {
    active: !!config?.gameActive,
    reason: null,
    endedBy: null,
  };

  if (!result.active) {
    result.reason = 'Game is paused by admin';
    result.endedBy = 'manual';
    return result;
  }

  if (config?.gameEndTime) {
    const endAt = new Date(config.gameEndTime);
    if (!Number.isNaN(endAt.getTime()) && now >= endAt) {
      return {
        active: false,
        reason: 'Game has ended',
        endedBy: 'end-time',
      };
    }
  }

  if ((config?.gameDurationMinutes || 0) > 0 && config?.updatedAt) {
    const startedAt = new Date(config.updatedAt);
    const endsAt = new Date(startedAt.getTime() + (config.gameDurationMinutes * 60 * 1000));
    if (!Number.isNaN(endsAt.getTime()) && now >= endsAt) {
      return {
        active: false,
        reason: 'Game duration has expired',
        endedBy: 'duration',
      };
    }
  }

  return result;
}

module.exports = { getEffectiveGameState };
