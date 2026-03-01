// ──────────────────────────────────────────────────────────────
// Team Profile – one-time edit for team name & password
// ──────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit3, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Profile() {
  const { team, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(team?.name || '');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const alreadyEdited = team?.profileEdited;
  const passwordAlreadyChanged = team?.passwordEdited;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (alreadyEdited) {
      toast.error('Profile can only be edited once');
      return;
    }
    if (!name.trim() && !password.trim()) {
      toast.error('Enter a new name or password');
      return;
    }
    if (password && password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setSaving(true);
    try {
      await updateProfile(name.trim() || undefined, password || undefined);
      toast.success('Profile updated!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordOnlySubmit = async (e) => {
    e?.preventDefault();
    if (!password.trim()) {
      toast.error('Enter a new password');
      return;
    }
    if (password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    setSaving(true);
    try {
      // Call updateProfile with only password
      await updateProfile(undefined, password || undefined);
      toast.success('Password updated!');
      // clear input
      setPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <Edit3 className="text-neon-cyan" size={20} />
        <h1 className="text-xl font-black text-white">Team Profile</h1>
      </div>

      {alreadyEdited ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-6 neon-border"
        >
          <div className="text-center mb-4">
            <CheckCircle2 size={40} className="text-neon-green mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-2">Profile Already Updated</h2>
            <p className="text-sm text-gray-400">
              Your team name can no longer be changed.{!passwordAlreadyChanged && ' You can still update your password below.'}
            </p>
          </div>

          {passwordAlreadyChanged ? (
            <div className="text-center py-2">
              <p className="text-sm text-gray-500">Your password has already been changed.</p>
            </div>
          ) : (
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
              New Password
            </label>
            <div className="relative mb-4">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-dark-800 border border-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all text-sm"
              />
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handlePasswordOnlySubmit}
              disabled={saving}
              className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-neon-cyan to-cyan-400 text-dark-900 shadow-neon hover:shadow-neon transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Lock size={16} />}
              {saving ? 'Saving...' : 'Update password'}
            </motion.button>
          </div>
          )}
        </motion.div>
      ) : (
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="glass rounded-2xl p-6 neon-border space-y-4"
        >
          <p className="text-xs text-gray-500">
            You can change your team name and password <strong className="text-neon-pink">once</strong>. Make it count!
          </p>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New team name"
              maxLength={40}
              className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
              New Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave empty to keep current"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-dark-800 border border-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all text-sm"
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={saving}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-neon-cyan to-cyan-400 text-dark-900 shadow-neon hover:shadow-neon transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Edit3 size={16} />}
            {saving ? 'Saving...' : 'Update Profile'}
          </motion.button>
        </motion.form>
      )}
    </div>
  );
}
