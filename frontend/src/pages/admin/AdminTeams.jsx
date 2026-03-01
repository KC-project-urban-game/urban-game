// ──────────────────────────────────────────────────────────────
// Admin Teams – create, view, reshuffle task queues, delete teams
// Only admin can create teams (self-registration is disabled)
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Users,
  Shuffle,
  Trash2,
  Loader2,
  Plus,
  UserPlus,
  X,
  Key,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import { PlusCircle } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

export default function AdminTeams() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  // keep as string so the input can be emptied by the user
  const [count, setCount] = useState('10');
  const [creatingUser, setCreatingUser] = useState(false);
  const [createdResults, setCreatedResults] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [expandedTeam, setExpandedTeam] = useState(null);

  // Modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null, id: null, name: '' });
  const [actionLoading, setActionLoading] = useState(false);

  const loadTeams = () => {
    api.get('/admin/teams')
      .then(({ data }) => { setTeams(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadTeams(); }, []);

  const handleGenerate = async () => {
    try {
      setCreatingUser(true);
      const parsed = parseInt(String(count || '').trim(), 10);
      if (!parsed || parsed <= 0) { toast.error('Enter a valid number of teams'); setCreatingUser(false); return; }
      const { data } = await api.post('/admin/teams/generate', { count: parsed });
      setCreatedResults(data);
      toast.success(`Created ${data.created.length} teams`);
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create teams');
    } finally {
      setCreatingUser(false);
    }
  };

  // PDF download now uses /admin/teams/print with created entries after generation

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newPassword.trim()) {
      toast.error('Name and password required');
      return;
    }
    setCreating(true);
    try {
      await api.post('/admin/teams', { name: newName.trim(), password: newPassword.trim() });
      toast.success(`Team "${newName.trim()}" created!`);
      setNewName('');
      setNewPassword('');
      setShowCreate(false);
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  const handleReshuffle = (id, name) => {
    setConfirmModal({ open: true, type: 'reshuffle', id, name });
  };

  const handleDelete = (id, name) => {
    setConfirmModal({ open: true, type: 'delete', id, name });
  };

  const handleConfirmAction = async () => {
    setActionLoading(true);
    try {
      if (confirmModal.type === 'reshuffle') {
        await api.put(`/admin/teams/${confirmModal.id}/reshuffle`);
        toast.success(`Task queue reshuffled for ${confirmModal.name}`);
      } else if (confirmModal.type === 'delete') {
        await api.delete(`/admin/teams/${confirmModal.id}`);
        toast.success(`Team "${confirmModal.name}" deleted`);
      }
      loadTeams();
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to ${confirmModal.type}`);
    } finally {
      setActionLoading(false);
      setConfirmModal({ open: false, type: null, id: null, name: '' });
    }
  };

  const closeConfirm = () => setConfirmModal({ open: false, type: null, id: null, name: '' });

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <Users className="text-neon-green" size={20} />
          <h1 className="text-xl font-black text-white">Teams</h1>
          <span className="text-xs text-gray-500 ml-1">{teams.length} teams</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon-green/20 text-neon-green text-xs font-bold hover:bg-neon-green/30 transition-colors"
          >
            {showCreate ? <X size={14} /> : <UserPlus size={14} />}
            {showCreate ? 'Cancel' : 'New'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon-cyan/20 text-neon-cyan text-xs font-bold hover:bg-neon-cyan/30 transition-colors"
            title="Generate teams in bulk"
          >
            <PlusCircle size={14} /> Generate
          </button>
        </div>
      </div>

      {/* Create team form */}
      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            onSubmit={handleCreate}
            className="glass rounded-2xl p-5 neon-border mb-6 space-y-3 overflow-hidden"
          >
            <h2 className="text-sm font-bold text-neon-green flex items-center gap-2">
              <UserPlus size={16} /> Create New Team
            </h2>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Team Name</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Team Alpha"
                maxLength={40}
                className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-neon-green/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Password</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="min 4 characters"
                className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-neon-green/50"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-neon-green to-green-400 text-dark-900 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {creating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-neon-cyan" size={32} />
        </div>
      ) : teams.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No teams yet. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {teams.map((team, i) => (
            <div key={team._id}>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setExpandedTeam(expandedTeam === team._id ? null : team._id)}
              className={`glass rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all ${
                expandedTeam === team._id
                  ? 'border border-neon-green/40 ring-1 ring-neon-green/20 rounded-b-none'
                  : 'neon-border'
              }`}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-dark-900 flex-shrink-0"
                style={{ backgroundColor: team.avatarColor }}
              >
                {team.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-white truncate">{team.name}</p>
                  {team.profileEdited && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-700 text-gray-400 font-semibold">
                      Edited
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500">
                  {team.taskQueue?.length || 0} tasks in queue · Created {new Date(team.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleReshuffle(team._id, team.name); }}
                    className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-neon-cyan transition-colors"
                    title="Reshuffle task queue"
                  >
                    <Shuffle size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(team._id, team.name); }}
                    className="p-2 rounded-lg hover:bg-dark-700 text-gray-400 hover:text-neon-pink transition-colors"
                    title="Delete team"
                  >
                    <Trash2 size={14} />
                  </button>
                  {expandedTeam === team._id ? (
                    <ChevronUp size={16} className="text-neon-green" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-600" />
                  )}
                </div>
            </motion.div>

            {/* Expanded info panel */}
            <AnimatePresence>
              {expandedTeam === team._id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="glass rounded-b-2xl p-4 border border-neon-green/20 border-t-0 space-y-2">
                    {!team.profileEdited && team.originalPassword ? (
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-neon-gold" />
                        <span className="text-xs text-gray-400">Password:</span>
                        <span className="text-sm font-mono font-bold text-neon-gold bg-dark-800 px-2 py-1 rounded-lg select-all">
                          {team.originalPassword}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Key size={14} className="text-gray-600" />
                        <span className="text-xs text-gray-500">Password changed by team (not available)</span>
                      </div>
                    )}
                    <div className="text-[10px] text-gray-600">
                      ID: {team._id}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Add Teams Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-full max-w-2xl bg-dark-900 rounded-2xl p-6 neon-border">
            <div className="flex items-center gap-2 mb-4">
              <PlusCircle className="text-neon-green" size={18} />
              <h2 className="text-lg font-bold">Add Teams</h2>
            </div>

            <div className="space-y-3">
              {!createdResults && (
                <div>
                  <label className="text-sm text-gray-400">Number of teams to generate</label>
                  <input
                    type="number"
                    min={1}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value || '0', 10))}
                    className="w-32 mt-2 p-2 rounded-lg bg-dark-800 text-white text-sm"
                  />
                </div>
              )}

              {/* CSV upload removed — use manual textarea only */}

              {createdResults && (
                <div className="bg-dark-800 p-3 rounded-lg text-sm">
                  <div className="font-semibold mb-2">Created</div>
                  {createdResults.created.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-1 border-b border-white/5">
                      <div>{c.name}</div>
                      <div className="text-xs text-gray-400">{c.password}</div>
                    </div>
                  ))}
                  {createdResults.errors?.length > 0 && (
                    <div className="mt-2 text-xs text-neon-pink">
                      Errors:
                      {createdResults.errors.map((e, i) => (
                        <div key={i}>{e.name || '<empty>'}: {e.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                {!createdResults ? (
                  <button
                    onClick={handleGenerate}
                    disabled={creatingUser}
                    className="px-4 py-2 bg-neon-cyan rounded-lg font-semibold"
                  >
                    {creatingUser ? 'Creating...' : 'Create Teams'}
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const resp = await api.post('/admin/teams/print', { entries: createdResults.created }, { responseType: 'blob' });
                        const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', 'team-passwords.pdf');
                        document.body.appendChild(link);
                        link.click();
                        link.parentNode.removeChild(link);
                      } catch (err) {
                        toast.error(err.response?.data?.error || 'Failed to generate PDF');
                      }
                    }}
                    className="px-4 py-2 bg-neon-gold text-dark-900 rounded-lg font-semibold"
                  >
                    Download PDF
                  </button>
                )}

                <button onClick={() => { setShowAdd(false); setCreatedResults(null); }} className="px-4 py-2 bg-dark-800 rounded-lg">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Reshuffle confirmation */}
      <ConfirmModal
        open={confirmModal.open && confirmModal.type === 'reshuffle'}
        title="Reshuffle Queue"
        message={`Reshuffle task queue for "${confirmModal.name}"? Their task order will be randomized.`}
        confirmLabel="Reshuffle"
        confirmColor="cyan"
        onConfirm={handleConfirmAction}
        onCancel={closeConfirm}
        loading={actionLoading}
      />

      {/* Delete confirmation */}
      <ConfirmModal
        open={confirmModal.open && confirmModal.type === 'delete'}
        title="Delete Team"
        message={`Delete team "${confirmModal.name}"? All their submissions will also be deleted. This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
        onConfirm={handleConfirmAction}
        onCancel={closeConfirm}
        loading={actionLoading}
      />
    </div>
  );
}
