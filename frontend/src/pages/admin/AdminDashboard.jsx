// ──────────────────────────────────────────────────────────────
// Admin Dashboard – overview stats + navigation to admin sections  
// ──────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  ListChecks,
  Image,
  Settings,
  Users,
  Loader2,
  Sparkles,
} from 'lucide-react';
import api from '../../api/axios';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats')
      .then(({ data }) => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const cards = [
    {
      to: '/admin/tasks',
      icon: ListChecks,
      label: 'Manage Tasks',
      desc: 'Add, edit, delete tasks & map points',
      color: 'text-neon-cyan',
      stat: stats ? `${stats.tasks} tasks` : null,
    },
    {
      to: '/admin/sidequests',
      icon: Sparkles,
      label: 'Manage Side Quests',
      desc: 'Add, edit, delete bonus challenges',
      color: 'text-neon-gold',
      stat: null,
    },
    {
      to: '/admin/photos',
      icon: Image,
      label: 'Photo Moderation',
      desc: 'Block or delete submitted photos',
      color: 'text-neon-pink',
      stat: stats ? `${stats.completed} photos` : null,
    },
    {
      to: '/admin/teams',
      icon: Users,
      label: 'Teams',
      desc: 'View teams, reshuffle queues',
      color: 'text-neon-green',
      stat: stats ? `${stats.teams} teams` : null,
    },
    {
      to: '/admin/config',
      icon: Settings,
      label: 'Game Settings',
      desc: 'Points, timers, map, registration',
      color: 'text-yellow-500',
      stat: null,
    },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Shield className="text-neon-gold" size={24} />
        <h1 className="text-xl font-black text-white">Admin Panel</h1>
      </div>

      {/* Stats overview */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-neon-cyan" size={32} />
        </div>
      ) : stats && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Teams', value: stats.teams, color: 'text-neon-green' },
            { label: 'Completed', value: stats.completed, color: 'text-neon-cyan' },
            { label: 'Blocked', value: stats.blocked, color: 'text-neon-pink' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-3 text-center neon-border"
            >
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Navigation cards */}
      <div className="space-y-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.to}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.08 }}
          >
            <Link
              to={card.to}
              className="block glass rounded-2xl p-4 neon-border active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center ${card.color}`}>
                  <card.icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm">{card.label}</h3>
                  <p className="text-xs text-gray-500">{card.desc}</p>
                </div>
                {card.stat && (
                  <span className="text-xs font-semibold text-gray-500">{card.stat}</span>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
