// ──────────────────────────────────────────────────────────────
// Admin Photo Moderation – block/delete/score submitted photos
// + approve/reject sidequest submissions
// Filters: category (tasks/sidequests), status, task, scored
// ──────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Image,
  Shield,
  ShieldOff,
  Trash2,
  Clock,
  Loader2,
  Star,
  Filter,
  CheckCircle2,
  XCircle,
  Sparkles,
  Target,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { ConfirmModal, InputModal } from '../../components/ConfirmModal';

function formatMs(ms) {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

export default function AdminPhotos() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('tasks'); // 'tasks' | 'sidequests'
  const [submissions, setSubmissions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | completed | blocked
  const [taskFilter, setTaskFilter] = useState('all'); // all | taskId
  const [scoredFilter, setScoredFilter] = useState('all'); // all | scored | unscored
  const [scoringId, setScoringId] = useState(null); // which submission is being scored
  const [scoreInput, setScoreInput] = useState('');

  // SideQuest submissions state
  const [sqSubmissions, setSqSubmissions] = useState([]);
  const [sqLoading, setSqLoading] = useState(true);
  const [sqFilter, setSqFilter] = useState('pending'); // pending | approved | rejected

  // Modal state
  const [blockModal, setBlockModal] = useState({ open: false, id: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
  const [actionLoading, setActionLoading] = useState(false);

  // Load tasks for the task filter dropdown
  useEffect(() => {
    api.get('/admin/tasks').then(({ data }) => setTasks(data)).catch(() => {});
  }, []);

  const loadSubmissions = () => {
    const params = filter !== 'all' ? `?status=${filter}` : '';
    api.get(`/admin/submissions${params}`)
      .then(({ data }) => { setSubmissions(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const loadSqSubmissions = useCallback(() => {
    setSqLoading(true);
    api.get('/admin/sidequests/submissions')
      .then(({ data }) => { setSqSubmissions(data); setSqLoading(false); })
      .catch(() => setSqLoading(false));
  }, []);

  useEffect(() => { setLoading(true); loadSubmissions(); }, [filter]);
  useEffect(() => { if (category === 'sidequests') loadSqSubmissions(); }, [category, loadSqSubmissions]);

  // Apply client-side filters (task + scored)
  const filteredSubmissions = submissions.filter((sub) => {
    if (taskFilter !== 'all' && sub.task?._id !== taskFilter) return false;
    if (scoredFilter === 'scored' && (sub.photoPoints == null)) return false;
    if (scoredFilter === 'unscored' && (sub.photoPoints != null)) return false;
    return true;
  });

  const handleBlock = (id) => {
    setBlockModal({ open: true, id });
  };

  const doBlock = async (reason) => {
    setActionLoading(true);
    try {
      await api.put(`/admin/submissions/${blockModal.id}/block`, { reason: reason || 'Blocked by admin' });
      toast.success('Photo blocked');
      setBlockModal({ open: false, id: null });
      loadSubmissions();
    } catch (err) {
      toast.error('Failed to block');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblock = async (id) => {
    try {
      await api.put(`/admin/submissions/${id}/unblock`);
      toast.success('Photo unblocked');
      loadSubmissions();
    } catch (err) {
      toast.error('Failed to unblock');
    }
  };

  const handleDelete = (id) => {
    setDeleteModal({ open: true, id });
  };

  const doDelete = async () => {
    setActionLoading(true);
    try {
      await api.delete(`/admin/submissions/${deleteModal.id}`);
      toast.success('Photo deleted — team can re-upload');
      setDeleteModal({ open: false, id: null });
      loadSubmissions();
    } catch (err) {
      toast.error('Failed to delete');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScore = async (id) => {
    const points = parseInt(scoreInput);
    if (isNaN(points) || points < 0) {
      toast.error('Enter a valid non-negative number');
      return;
    }
    try {
      await api.put(`/admin/submissions/${id}/score`, { points });
      toast.success(`Awarded ${points} points`);
      setScoringId(null);
      setScoreInput('');
      loadSubmissions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to score');
    }
  };

  // ── SideQuest review ──────────────────────────────────────
  const reviewSqSubmission = async (subId, action) => {
    try {
      await api.put(`/admin/sidequests/submissions/${subId}/${action}`);
      toast.success(action === 'approve' ? 'Approved!' : 'Rejected!');
      loadSqSubmissions();
    } catch (err) {
      toast.error('Action failed');
    }
  };

  const filteredSqSubs = sqSubmissions.filter((s) => {
    if (sqFilter === 'pending')  return s.status === 'pending';
    if (sqFilter === 'approved') return s.status === 'approved';
    if (sqFilter === 'rejected') return s.status === 'rejected';
    return true;
  });

  const pendingSqCount  = sqSubmissions.filter((s) => s.status === 'pending').length;
  const approvedSqCount = sqSubmissions.filter((s) => s.status === 'approved').length;
  const rejectedSqCount = sqSubmissions.filter((s) => s.status === 'rejected').length;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <Image className="text-neon-pink" size={20} />
        <h1 className="text-xl font-black text-white">Photo Moderation</h1>
      </div>

      {/* Category toggle: Tasks / Side Quests */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setCategory('tasks')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            category === 'tasks'
              ? 'bg-neon-cyan/20 text-neon-cyan neon-border'
              : 'glass text-gray-400 hover:text-white'
          }`}
        >
          <Target size={14} /> Tasks
        </button>
        <button
          onClick={() => setCategory('sidequests')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            category === 'sidequests'
              ? 'bg-neon-gold/20 text-neon-gold border border-neon-gold/30'
              : 'glass text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles size={14} /> Side Quests
          {pendingSqCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-yellow-500/30 text-yellow-400 text-[10px] font-black">
              {pendingSqCount}
            </span>
          )}
        </button>
      </div>

      {category === 'tasks' ? (
      <>
      {/* Filter: Status */}
      <div className="flex gap-2 mb-3">
        {['all', 'completed', 'blocked'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              filter === f
                ? 'bg-neon-cyan/20 text-neon-cyan neon-border'
                : 'glass text-gray-400'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Filter: Task + Scored */}
      <div className="flex gap-2 mb-5">
        <select
          value={taskFilter}
          onChange={(e) => setTaskFilter(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg bg-dark-800 border border-white/5 text-xs text-white focus:outline-none focus:border-neon-cyan/50"
        >
          <option value="all">All Tasks</option>
          {tasks.map((t) => (
            <option key={t._id} value={t._id}>{t.title}</option>
          ))}
        </select>
        <select
          value={scoredFilter}
          onChange={(e) => setScoredFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-dark-800 border border-white/5 text-xs text-white focus:outline-none focus:border-neon-cyan/50"
        >
          <option value="all">All</option>
          <option value="scored">Scored</option>
          <option value="unscored">Unscored</option>
        </select>
      </div>

      {/* Submissions */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-neon-cyan" size={32} />
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <Image size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No submissions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((sub, i) => (
            <motion.div
              key={sub._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className={`glass rounded-2xl overflow-hidden ${
                sub.status === 'blocked' ? 'border border-red-500/30' : 'neon-border'
              }`}
            >
              {/* Team & task info */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-dark-900"
                  style={{ backgroundColor: sub.team?.avatarColor || '#00f0ff' }}
                >
                  {sub.team?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{sub.team?.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{sub.task?.title}</span>
                    <span>·</span>
                    <span>{timeAgo(sub.photoSubmittedAt)}</span>
                    {sub.elapsedMs && (
                      <>
                        <span>·</span>
                        <span className="text-neon-green flex items-center gap-0.5">
                          <Clock size={8} /> {formatMs(sub.elapsedMs)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    sub.status === 'blocked'
                      ? 'bg-red-500/20 text-red-400'
                      : sub.status === 'completed'
                      ? 'bg-neon-green/20 text-neon-green'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {sub.status}
                  </span>
                  {sub.photoPoints != null && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-neon-gold/20 text-neon-gold flex items-center gap-0.5">
                      <Star size={8} /> {sub.photoPoints} pts
                    </span>
                  )}
                </div>
              </div>

              {/* Photo */}
              {sub.photoUrl && (
                <div className="relative">
                  <img
                    src={sub.photoUrl}
                    alt="Submission"
                    className={`w-full aspect-[4/3] object-cover ${
                      sub.status === 'blocked' ? 'opacity-40 grayscale' : ''
                    }`}
                    loading="lazy"
                  />
                  {sub.status === 'blocked' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-red-500/80 text-white px-4 py-2 rounded-lg font-bold text-sm">
                        BLOCKED
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Block reason */}
              {sub.blockReason && (
                <div className="px-4 py-2 text-xs text-red-400 bg-red-500/5">
                  Reason: {sub.blockReason}
                </div>
              )}

              {/* Scoring inline */}
              {scoringId === sub._id ? (
                <div className="px-4 py-3 flex items-center gap-2 bg-dark-800/50">
                  <Star size={14} className="text-neon-gold flex-shrink-0" />
                  <input
                    type="number"
                    min="0"
                    value={scoreInput}
                    onChange={(e) => setScoreInput(e.target.value)}
                    placeholder="Points"
                    autoFocus
                    className="flex-1 px-3 py-1.5 rounded-lg bg-dark-800 border border-white/10 text-white text-sm focus:outline-none focus:border-neon-gold/50"
                    onKeyDown={(e) => e.key === 'Enter' && handleScore(sub._id)}
                  />
                  <button
                    onClick={() => handleScore(sub._id)}
                    className="px-3 py-1.5 rounded-lg bg-neon-gold/20 text-neon-gold text-xs font-bold hover:bg-neon-gold/30"
                  >
                    Award
                  </button>
                  <button
                    onClick={() => { setScoringId(null); setScoreInput(''); }}
                    className="px-2 py-1.5 rounded-lg text-gray-500 text-xs hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              ) : null}

              {/* Actions */}
              <div className="px-4 py-3 flex items-center gap-2">
                {/* Score button */}
                <button
                  onClick={() => { setScoringId(sub._id); setScoreInput(sub.photoPoints != null ? String(sub.photoPoints) : ''); }}
                  className="flex-1 py-2 rounded-lg glass text-xs font-semibold text-neon-gold flex items-center justify-center gap-1.5 hover:bg-neon-gold/10 transition-colors"
                >
                  <Star size={14} />
                  {sub.photoPoints != null ? 'Re-score' : 'Score'}
                </button>

                {sub.status === 'blocked' ? (
                  <button
                    onClick={() => handleUnblock(sub._id)}
                    className="flex-1 py-2 rounded-lg glass text-xs font-semibold text-neon-green flex items-center justify-center gap-1.5 hover:bg-neon-green/10 transition-colors"
                  >
                    <ShieldOff size={14} />
                    Unblock
                  </button>
                ) : (
                  <button
                    onClick={() => handleBlock(sub._id)}
                    className="flex-1 py-2 rounded-lg glass text-xs font-semibold text-yellow-400 flex items-center justify-center gap-1.5 hover:bg-yellow-500/10 transition-colors"
                  >
                    <Shield size={14} />
                    Block
                  </button>
                )}
                <button
                  onClick={() => handleDelete(sub._id)}
                  className="py-2 px-3 rounded-lg glass text-xs font-semibold text-neon-pink flex items-center justify-center gap-1.5 hover:bg-neon-pink/10 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      </>
      ) : (
      <>
      {/* SideQuest Submissions */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'pending',  label: 'Pending',  count: pendingSqCount,  color: 'text-yellow-400' },
          { key: 'approved', label: 'Approved', count: approvedSqCount, color: 'text-neon-green' },
          { key: 'rejected', label: 'Rejected', count: rejectedSqCount, color: 'text-neon-pink' },
        ].map((f) => (
          <button key={f.key} onClick={() => setSqFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              sqFilter === f.key
                ? 'bg-neon-gold/20 text-neon-gold border border-neon-gold/30'
                : 'glass text-gray-400 hover:text-white border border-transparent'
            }`}>
            {f.label}
            <span className={`text-[10px] font-black ${sqFilter === f.key ? 'text-neon-gold' : f.color}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {sqLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="animate-spin text-neon-cyan" size={32} /></div>
      ) : filteredSqSubs.length === 0 ? (
        <div className="text-center py-16 text-gray-500 text-sm">No submissions in this category</div>
      ) : (
        <div className="space-y-3">
          {filteredSqSubs.map((sub, i) => (
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

              {/* Actions */}
              <div className="px-4 py-3 flex items-center gap-2">
                <button
                  onClick={() => reviewSqSubmission(sub._id, 'approve')}
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
                  onClick={() => reviewSqSubmission(sub._id, 'reject')}
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
      )}

      {/* Block reason modal */}
      <InputModal
        open={blockModal.open}
        title="Block Photo"
        message="Enter a reason for blocking this photo (optional). The team will get 0 points and will not be able to re-upload."
        placeholder="Block reason (optional)"
        confirmLabel="Block"
        confirmColor="red"
        onConfirm={doBlock}
        onCancel={() => setBlockModal({ open: false, id: null })}
        loading={actionLoading}
      />

      {/* Delete confirm modal */}
      <ConfirmModal
        open={deleteModal.open}
        title="Delete Photo"
        message="Delete this photo? The team will be able to re-upload a new photo for this task."
        confirmLabel="Delete"
        confirmColor="red"
        onConfirm={doDelete}
        onCancel={() => setDeleteModal({ open: false, id: null })}
        loading={actionLoading}
      />
    </div>
  );
}
