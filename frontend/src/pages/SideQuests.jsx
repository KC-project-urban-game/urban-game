// ──────────────────────────────────────────────────────────────
// SideQuests page – tile grid with expand-to-modal photo upload
// Team sees: tiles + summary (submitted / approved / rejected)
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Camera, X, Loader2, Upload, Clock, XCircle, ThumbsUp } from 'lucide-react';
import api from '../api/axios';
import toast from 'react-hot-toast';

const statusConfig = {
  pending:  { label: 'Pending', color: 'text-yellow-400', border: 'border-yellow-500/30', icon: Clock },
  approved: { label: 'Approved', color: 'text-neon-green', border: 'border-neon-green/30', icon: ThumbsUp },
  rejected: { label: 'Rejected', color: 'text-neon-pink', border: 'border-neon-pink/30', icon: XCircle },
};

export default function SideQuests() {
  const [quests, setQuests] = useState([]);
  const [summary, setSummary] = useState({ submitted: 0, approved: 0, rejected: 0, pending: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    api.get('/sidequests')
      .then(({ data }) => {
        setQuests(data.quests || []);
        setSummary(data.summary || { submitted: 0, approved: 0, rejected: 0, pending: 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file || !selected) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await api.post(`/sidequests/${selected._id}/submit`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Submitted! Waiting for admin review.');
      closeModal();
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const closeModal = () => { setSelected(null); setFile(null); setPreview(null); };

  const canSubmit = (q) => !q.submitted;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="text-neon-gold" size={22} />
          <h1 className="text-xl font-black text-white">Side Quests</h1>
        </div>
        <p className="text-xs text-gray-500">Bonus challenges — tap a card to submit a photo!</p>
      </div>

      {/* Summary stats */}
      {!loading && quests.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Submitted', value: summary.submitted, color: 'text-neon-cyan' },
            { label: 'Approved', value: summary.approved, color: 'text-neon-green' },
            { label: 'Rejected', value: summary.rejected, color: 'text-neon-pink' },
          ].map((s) => (
            <div key={s.label} className="glass rounded-xl p-3 text-center neon-border">
              <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-neon-cyan" size={32} />
        </div>
      ) : quests.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Sparkles size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No side quests available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {quests.map((q, i) => {
            const cfg = q.status ? statusConfig[q.status] : null;
            const StatusIcon = cfg?.icon;
            return (
              <motion.button
                key={q._id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => canSubmit(q) && setSelected(q)}
                disabled={q.submitted}
                className={`relative text-left glass rounded-2xl p-4 transition-all active:scale-[0.97] ${
                  q.submitted
                    ? cfg?.border || 'border border-white/10'
                    : 'border border-white/5 hover:border-neon-gold/40'
                } ${q.submitted ? 'opacity-80' : ''}`}
              >
                {/* Status badge */}
                {q.submitted && cfg && (
                  <div className={`absolute top-2 right-2 flex items-center gap-1 ${cfg.color}`}>
                    <StatusIcon size={14} />
                  </div>
                )}

                <h3 className="text-sm font-bold text-white mb-1 pr-6 line-clamp-2">{q.title}</h3>
                {q.description && (
                  <p className="text-[11px] text-gray-500 line-clamp-2 mb-2">{q.description}</p>
                )}

                {/* Status label */}
                {q.submitted && cfg && (
                  <span className={`text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
                )}
                {!q.submitted && (
                  <span className="text-[10px] font-bold text-gray-600">To do</span>
                )}

                {/* Photo thumbnail */}
                {q.submitted && q.photoUrl && (
                  <img src={q.photoUrl} alt="" className="mt-2 w-full h-16 object-cover rounded-lg opacity-60" />
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* ── Expanded modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative glass rounded-2xl p-6 max-w-sm w-full border border-neon-gold/30 z-10"
            >
              <button onClick={closeModal} className="absolute top-3 right-3 text-gray-500 hover:text-white">
                <X size={20} />
              </button>

              <Sparkles className="text-neon-gold mb-2" size={28} />
              <h2 className="text-lg font-black text-white mb-1">{selected.title}</h2>
              {selected.description && (
                <p className="text-sm text-gray-400 mb-5">{selected.description}</p>
              )}

              {preview && (
                <img src={preview} alt="Preview" className="w-full aspect-[4/3] object-cover rounded-xl mb-4 border border-white/10" />
              )}

              <label className="block w-full cursor-pointer mb-3">
                <div className="flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-white/10 hover:border-neon-gold/40 transition-colors">
                  <Camera size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-400">{file ? file.name : 'Take or choose photo…'}</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>

              <button
                onClick={handleSubmit}
                disabled={!file || uploading}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-neon-gold to-yellow-400 text-dark-900 flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
              >
                {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                {uploading ? 'Uploading…' : 'Submit Photo'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
