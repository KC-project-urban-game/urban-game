// ──────────────────────────────────────────────────────────────
// Admin SideQuests – CRUD + approve/reject submissions
// ──────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Save, X, Loader2,
  AlertTriangle, Sparkles, Eye, Camera,
  CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';

// ── Confirmation Modal ────────────────────────────────────────
function ConfirmModal({ open, title, message, confirmLabel, confirmColor, onConfirm, onCancel, loading }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="relative glass rounded-2xl p-6 max-w-sm w-full border border-white/10 z-10"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
            <AlertTriangle size={20} className="text-yellow-400" />
          </div>
          <h3 className="text-white font-bold text-base">{title}</h3>
        </div>
        <p className="text-gray-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-white/10 text-gray-400 hover:bg-white/5 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
              confirmColor === 'red'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                : 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/30'
            }`}>
            {loading && <Loader2 className="animate-spin" size={14} />}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const emptySQ = { title: '', description: '', isActive: true };

export default function AdminSideQuests() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('manage');
  const [subFilter, setSubFilter] = useState('pending');

  // Manage state
  const [quests, setQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptySQ });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, type: null, id: null });

  // Submissions state
  const [submissions, setSubmissions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(false);

  const loadQuests = useCallback(() => {
    api.get('/admin/sidequests')
      .then(({ data }) => { setQuests(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadSubmissions = useCallback(() => {
    setSubsLoading(true);
    api.get('/admin/sidequests/submissions')
      .then(({ data }) => { setSubmissions(data); setSubsLoading(false); })
      .catch(() => setSubsLoading(false));
  }, []);

  useEffect(() => { loadQuests(); }, [loadQuests]);
  useEffect(() => { if (tab === 'submissions') loadSubmissions(); }, [tab, loadSubmissions]);

  // CRUD
  const openNew = () => { setEditing('new'); setForm({ ...emptySQ }); };
  const openEdit = (q) => {
    if (editing === q._id) { setEditing(null); return; }
    setEditing(q._id);
    setForm({ title: q.title, description: q.description || '', isActive: q.isActive });
  };
  const cancelEdit = () => { setEditing(null); setForm({ ...emptySQ }); };
  const updateField = (f, v) => setForm((prev) => ({ ...prev, [f]: v }));

  const doSave = async () => {
    if (!form.title) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      if (editing === 'new') {
        await api.post('/admin/sidequests', form);
        toast.success('SideQuest created!');
      } else {
        await api.put(`/admin/sidequests/${editing}`, form);
        toast.success('SideQuest updated!');
      }
      cancelEdit(); loadQuests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally { setSaving(false); setConfirm({ open: false, type: null, id: null }); }
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/admin/sidequests/${confirm.id}`);
      toast.success('SideQuest deleted');
      if (editing === confirm.id) cancelEdit();
      loadQuests();
    } catch (err) { toast.error('Failed to delete'); }
    finally { setSaving(false); setConfirm({ open: false, type: null, id: null }); }
  };

  const handleConfirm = () => { if (confirm.type === 'delete') doDelete(); else doSave(); };
  const closeConfirm = () => setConfirm({ open: false, type: null, id: null });

  // Approve / Reject
  const reviewSubmission = async (subId, action) => {
    try {
      await api.put(`/admin/sidequests/submissions/${subId}/${action}`);
      toast.success(action === 'approve' ? 'Approved!' : 'Rejected!');
      loadSubmissions();
    } catch (err) {
      toast.error('Action failed');
    }
  };

  // Filter
  const filteredSubs = submissions.filter((s) => {
    if (subFilter === 'pending')  return s.status === 'pending';
    if (subFilter === 'approved') return s.status === 'approved';
    if (subFilter === 'rejected') return s.status === 'rejected';
    return true;
  });

  const pendingCount  = submissions.filter((s) => s.status === 'pending').length;
  const approvedCount = submissions.filter((s) => s.status === 'approved').length;
  const rejectedCount = submissions.filter((s) => s.status === 'rejected').length;

  // ── Manage tab ──────────────────────────────────────────────
  const renderManage = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-gray-500">{quests.length} sidequests</span>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon-gold/20 text-neon-gold text-xs font-bold hover:bg-neon-gold/30 transition-colors">
          <Plus size={14} /> Add
        </button>
      </div>

      <AnimatePresence>
        {editing === 'new' && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="glass rounded-2xl p-5 border border-neon-gold/30 mb-5 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-neon-gold">New SideQuest</h2>
              <button onClick={cancelEdit} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <SQForm form={form} updateField={updateField} />
            <button onClick={doSave} disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-neon-gold to-yellow-400 text-dark-900 flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              {saving ? 'Creating…' : 'Create SideQuest'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-neon-cyan" size={32} /></div>
      ) : quests.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">No sidequests yet</div>
      ) : (
        <div className="space-y-2">
          {quests.map((q) => (
            <div key={q._id}>
              <div onClick={() => openEdit(q)}
                className={`glass rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                  editing === q._id
                    ? 'border border-neon-gold/40 ring-1 ring-neon-gold/20 rounded-b-none'
                    : q.isActive
                      ? 'border border-white/5 hover:border-white/15'
                      : 'border border-red-500/20 opacity-60 hover:opacity-80'
                }`}>
                <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-xs font-bold text-neon-gold shrink-0">
                  <Sparkles size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{q.title}</h3>
                  {!q.isActive && <span className="text-[10px] text-red-400">Inactive</span>}
                </div>
                {editing === q._id ? (
                  <ChevronUp size={16} className="text-neon-gold" />
                ) : (
                  <ChevronDown size={16} className="text-gray-600" />
                )}
              </div>

              <AnimatePresence>
                {editing === q._id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden">
                    <div className="glass rounded-b-xl p-4 border-x border-b border-neon-gold/30 space-y-3">
                      <SQForm form={form} updateField={updateField} />
                      <div className="flex gap-2">
                        <button onClick={cancelEdit}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-white/10 text-gray-400 hover:bg-white/5">
                          Cancel
                        </button>
                        <button onClick={() => setConfirm({ open: true, type: 'delete', id: q._id })}
                          className="py-2.5 px-4 rounded-xl text-xs font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
                          title="Delete sidequest">
                          <Trash2 size={12} /> Delete
                        </button>
                        <button onClick={() => setConfirm({ open: true, type: 'save', id: q._id })} disabled={saving}
                          className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-neon-gold/20 text-neon-gold border border-neon-gold/30 hover:bg-neon-gold/30 flex items-center justify-center gap-1.5 disabled:opacity-50">
                          {saving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                          Save
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── Submissions tab ─────────────────────────────────────────
  const renderSubmissions = () => (
    <>
      {/* Filter bar with counts */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'pending',  label: 'Pending', count: pendingCount,  color: 'text-yellow-400' },
          { key: 'approved', label: 'Approved', count: approvedCount, color: 'text-neon-green' },
          { key: 'rejected', label: 'Rejected', count: rejectedCount, color: 'text-neon-pink' },
        ].map((f) => (
          <button key={f.key} onClick={() => setSubFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              subFilter === f.key
                ? 'bg-neon-gold/20 text-neon-gold border border-neon-gold/30'
                : 'glass text-gray-400 hover:text-white border border-transparent'
            }`}>
            {f.label}
            <span className={`text-[10px] font-black ${subFilter === f.key ? 'text-neon-gold' : f.color}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {subsLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-neon-cyan" size={32} /></div>
      ) : filteredSubs.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">No submissions in this category</div>
      ) : (
        <div className="space-y-3">
          {filteredSubs.map((sub, i) => (
            <motion.div key={sub._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={`glass rounded-2xl overflow-hidden ${
                sub.status === 'approved' ? 'border border-neon-green/20'
                : sub.status === 'rejected' ? 'border border-neon-pink/20'
                : 'border border-yellow-500/20'
              }`}>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-dark-900"
                  style={{ backgroundColor: sub.team?.avatarColor || '#ffd700' }}>
                  {sub.team?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{sub.team?.name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{sub.sideQuest?.title}</p>
                </div>
                {/* Status badge */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  sub.status === 'approved' ? 'bg-neon-green/20 text-neon-green'
                  : sub.status === 'rejected' ? 'bg-neon-pink/20 text-neon-pink'
                  : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {sub.status === 'approved' ? 'Approved' : sub.status === 'rejected' ? 'Rejected' : 'Pending'}
                </span>
              </div>

              {/* Photo */}
              {sub.photoUrl && (
                <img src={sub.photoUrl} alt="" className="w-full aspect-[4/3] object-cover" loading="lazy" />
              )}

              {/* Action buttons */}
              <div className="px-4 py-3 flex items-center gap-2">
                <button
                  onClick={() => reviewSubmission(sub._id, 'approve')}
                  disabled={sub.status === 'approved'}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    sub.status === 'approved'
                      ? 'bg-neon-green/20 text-neon-green border border-neon-green/30 opacity-60'
                      : 'border border-neon-green/30 text-neon-green hover:bg-neon-green/20'
                  }`}>
                  <CheckCircle2 size={14} />
                  Approve
                </button>
                <button
                  onClick={() => reviewSubmission(sub._id, 'reject')}
                  disabled={sub.status === 'rejected'}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    sub.status === 'rejected'
                      ? 'bg-neon-pink/20 text-neon-pink border border-neon-pink/30 opacity-60'
                      : 'border border-neon-pink/30 text-neon-pink hover:bg-neon-pink/20'
                  }`}>
                  <XCircle size={14} />
                  Reject
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <Sparkles className="text-neon-gold" size={20} />
        <h1 className="text-xl font-black text-white">Side Quests</h1>
      </div>

      {/* Tabs - removed submissions tab (moved to Photo Moderation) */}

      {renderManage()}

      <ConfirmModal
        open={confirm.open}
        title={confirm.type === 'delete' ? 'Delete SideQuest?' : 'Save changes?'}
        message={confirm.type === 'delete'
          ? 'This will permanently delete this sidequest and all its submissions.'
          : 'Are you sure you want to save changes?'}
        confirmLabel={confirm.type === 'delete' ? 'Delete' : 'Save'}
        confirmColor={confirm.type === 'delete' ? 'red' : 'cyan'}
        onConfirm={handleConfirm}
        onCancel={closeConfirm}
        loading={saving}
      />
    </div>
  );
}

// ── Reusable form (no points field) ───────────────────────────
function SQForm({ form, updateField }) {
  return (
    <>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Title *</label>
        <input value={form.title} onChange={(e) => updateField('title', e.target.value)}
          className="w-full mt-1 px-3 py-2 rounded-xl bg-dark-700 text-white text-sm border border-white/5 focus:border-neon-gold/40 focus:outline-none"
          placeholder="SideQuest title" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Description</label>
        <textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows="2"
          className="w-full mt-1 px-3 py-2 rounded-xl bg-dark-700 text-white text-sm border border-white/5 focus:border-neon-gold/40 focus:outline-none resize-none"
          placeholder="Optional description" />
      </div>
      <div className="flex items-center">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.isActive} onChange={(e) => updateField('isActive', e.target.checked)}
            className="accent-neon-gold w-4 h-4" />
          <span className="text-xs text-gray-400">Active</span>
        </label>
      </div>
    </>
  );
}
