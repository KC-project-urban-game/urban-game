import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import api from '../api/axios';

export default function Login() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [gameTitle, setGameTitle] = useState('Urban Game');
  const [gameSubtitle, setGameSubtitle] = useState('Live Edition');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/config')
      .then(({ data }) => {
        if (data?.gameTitle) setGameTitle(data.gameTitle);
        if (data?.gameSubtitle) setGameSubtitle(data.gameSubtitle);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      toast.error('Fill in all fields');
      return;
    }
    try {
      const result = await login(name.trim(), password);
      toast.success('Welcome back!');
      // Full page redirect ensures clean React tree when switching roles
      if (result?.team?.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Login error:', err);
      toast.error(err.response?.data?.error || err.message || 'Something went wrong');
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-[-30%] left-[-20%] w-[500px] h-[500px] bg-neon-cyan/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[400px] h-[400px] bg-neon-pink/10 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-sm z-10"
      >
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-neon-cyan/20 to-neon-pink/20 neon-border mb-4"
          >
            <Target className="text-neon-cyan" size={36} />
          </motion.div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-neon-cyan neon-glow">{gameTitle}</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2 font-medium">{gameSubtitle}</p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4 neon-border">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your team name"
              maxLength={40}
              className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Team password"
              className="w-full px-4 py-3 rounded-xl bg-dark-800 border border-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30 transition-all text-sm"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm tracking-wide bg-gradient-to-r from-neon-cyan to-cyan-400 text-dark-900 shadow-neon hover:shadow-neon transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Zap size={16} />
            {loading ? 'Loading...' : 'Enter the Hunt'}
          </motion.button>
        </form>

        <p className="text-center mt-5 text-sm text-gray-500">
          Ask the admin to create your team account.
        </p>
      </motion.div>
    </div>
  );
}
