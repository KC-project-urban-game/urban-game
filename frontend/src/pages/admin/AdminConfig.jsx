// ──────────────────────────────────────────────────────────────
// Admin Game Config – edit points, timers, map settings, etc.
// ★ ALL GAME SETTINGS IN ONE PLACE – EASY TO MODIFY
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Settings, Save, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { InputModal } from '../../components/ConfirmModal';

const FIELDS = [
  { section: 'Scoring & Points', fields: [
    { key: 'defaultTaskPoints', label: 'Default Task Points', type: 'number', desc: 'Base points for each task (can be overridden per task)' },
    { key: 'timeBonusThresholdSec', label: 'Time Bonus Threshold (sec)', type: 'number', desc: 'Complete under this time = bonus points' },
    { key: 'timeBonusPoints', label: 'Time Bonus Points', type: 'number', desc: 'Extra points for fast completion' },
    { key: 'hintPenaltyPoints', label: 'Hint Penalty Points', type: 'number', desc: 'Points deducted for using a hint (0 = no penalty)' },
  ]},
  { section: 'Timed Reveals', fields: [
    { key: 'hintRevealDelaySec', label: 'Hint Reveal Delay (sec)', type: 'number', desc: 'Seconds after starting a task before the hint auto-reveals (e.g. 180 = 3 min)' },
    { key: 'locationRevealDelaySec', label: 'Location Reveal Delay (sec)', type: 'number', desc: 'Seconds after starting before the map pin is shown (e.g. 360 = 6 min)' },
  ]},
  { section: 'Leaderboard', fields: [
    { key: 'leaderboardMode', label: 'Ranking Mode', type: 'select', options: ['fastest', 'most-tasks'], desc: '"fastest" = rank by time, "most-tasks" = tasks first, then time' },
  ]},
    { section: 'Game State', fields: [
    { key: 'gameActive', label: 'Game Active', type: 'toggle', desc: 'Turn the whole game on/off' },
    { key: 'gameTitle', label: 'Game Title', type: 'text', desc: 'Shown in the app header' },
    { key: 'gameSubtitle', label: 'Game Subtitle', type: 'text', desc: 'Shown below the title' },
    { key: 'shuffleTaskOrder', label: 'Shuffle Task Order', type: 'toggle', desc: 'Each team gets a different random order' },
  ]},
  { section: 'Game End Timer', fields: [
    { key: 'gameDurationMinutes', label: 'Game Duration (min)', type: 'number', desc: 'Auto-stop game after this many minutes (0 = no limit)' },
    { key: 'gameEndTime', label: 'Game End Time (ISO)', type: 'text', desc: 'Specific end time (e.g. 2026-06-15T16:00:00Z). Leave empty for no fixed end time.' },
  ]},
  { section: 'Map Settings', fields: [
    { key: 'mapCenterLat', label: 'Map Center Latitude', type: 'number', desc: 'Venue center latitude' },
    { key: 'mapCenterLng', label: 'Map Center Longitude', type: 'number', desc: 'Venue center longitude' },
    { key: 'mapZoom', label: 'Map Zoom Level', type: 'number', desc: 'Default zoom (15-19 recommended)' },
    { key: 'boundaryRadiusMeters', label: 'Game Boundary Radius (m)', type: 'number', desc: 'Draws a circle on the map showing the game area (0 = no circle)' },
  ]},
];

export default function AdminConfig() {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resettingRound, setResettingRound] = useState(false);

  useEffect(() => {
    api.get('/admin/config')
      .then(({ data }) => { setConfig(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const updateField = (key, value) => {
    setConfig((c) => ({ ...c, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/admin/config', config);
      setConfig(data);
      toast.success('Settings saved!');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetRound = async (value) => {
    if (String(value || '').trim() !== 'RESET ROUND') {
      toast.error('Type RESET ROUND exactly to confirm.');
      return;
    }

    setResettingRound(true);
    try {
      const { data } = await api.post('/admin/reset-round', { confirmation: 'RESET ROUND' });
      const deleted = data?.deleted || {};
      toast.success(
        `Reset complete: ${deleted.teams || 0} teams, ${deleted.taskSubmissions || 0} task submissions, ${deleted.sideQuestSubmissions || 0} side quest submissions removed.`
      );
      setResetModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset round');
    } finally {
      setResettingRound(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-neon-cyan" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <Settings className="text-neon-gold" size={20} />
        <h1 className="text-xl font-black text-white">Game Settings</h1>
      </div>

      {/* Settings sections */}
      <div className="space-y-6">
        {FIELDS.map(({ section, fields }) => (
          <motion.div
            key={section}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h2 className="text-xs font-bold text-neon-cyan uppercase tracking-widest">{section}</h2>
            <div className="glass rounded-2xl p-4 space-y-4 neon-border">
              {fields.map(({ key, label, type, desc, options }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-white">{label}</label>
                    {type === 'toggle' && (
                      <button
                        onClick={() => updateField(key, !config[key])}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          config[key] ? 'bg-neon-cyan' : 'bg-dark-700'
                        }`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          config[key] ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mb-1.5">{desc}</p>

                  {type === 'number' && (
                    <input
                      type="number"
                      step="any"
                      value={config[key] ?? ''}
                      onChange={(e) => updateField(key, parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-white text-sm focus:outline-none focus:border-neon-cyan/50"
                    />
                  )}
                  {type === 'text' && (
                    <input
                      type="text"
                      value={config[key] ?? ''}
                      onChange={(e) => updateField(key, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-white text-sm focus:outline-none focus:border-neon-cyan/50"
                    />
                  )}
                  {type === 'select' && (
                    <select
                      value={config[key] ?? ''}
                      onChange={(e) => updateField(key, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-white text-sm focus:outline-none focus:border-neon-cyan/50"
                    >
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6"
      >
        <h2 className="text-xs font-bold text-red-400 uppercase tracking-widest">Danger Zone</h2>
        <div className="glass rounded-2xl p-4 mt-3 space-y-4 border border-red-500/25">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Reset Round (Full Player Data Purge)</p>
              <p className="text-xs text-gray-400 mt-1">
                Deletes all non-admin teams, task submissions, side quest submissions, and uploaded player photos.
                Tasks, side quests, and game settings are preserved.
              </p>
            </div>
          </div>
          <button
            onClick={() => setResetModalOpen(true)}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-colors"
          >
            <RotateCcw size={16} />
            Purge Player Data
          </button>
        </div>
      </motion.div>

      {/* Save button (sticky) */}
      <div className="sticky bottom-20 mt-[30px]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-neon-gold to-yellow-400 text-dark-900 flex items-center justify-center gap-2 disabled:opacity-50 shadow-neon-gold"
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save All Settings'}
        </button>
      </div>

      <InputModal
        open={resetModalOpen}
        title="Reset Round"
        message="Type RESET ROUND to permanently purge all player data and start a fresh game round."
        placeholder="RESET ROUND"
        confirmLabel="Purge Data"
        confirmColor="red"
        onConfirm={handleResetRound}
        onCancel={() => setResetModalOpen(false)}
        loading={resettingRound}
        required
      />
    </div>
  );
}
