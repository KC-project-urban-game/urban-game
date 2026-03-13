import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, CheckCircle2, Clock, Loader2, List, Map as MapIcon } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import TaskMap from '../components/TaskMap';
import ErrorBoundary from '../components/ErrorBoundary';

const statusColors = {
  'not-started': 'border-white/5',
  'in-progress': 'neon-border animate-pulse-neon',
  completed: 'border-neon-green/30',
};

const statusBadge = {
  'not-started': { label: 'New', color: 'bg-gray-700 text-gray-300' },
  'in-progress': { label: 'Active', color: 'bg-neon-cyan/20 text-neon-cyan' },
  completed: { label: 'Done', color: 'bg-neon-green/20 text-neon-green' },
};

function formatMs(ms) {
  if (!ms) return null;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' or 'map'
  const [config, setConfig] = useState(null);
  const { team } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/tasks'),
      api.get('/config'),
    ]).then(([tasksRes, configRes]) => {
      setTasks(tasksRes.data);
      setConfig(configRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-6 pb-3 max-w-lg mx-auto w-full">
        <div className="mb-4">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">Team</p>
          <h1 className="text-2xl font-black text-white">{team?.name || 'Explorer'}</h1>
          <p className="text-sm text-gray-400 mt-1">
            Complete all challenges. Speed matters!
          </p>
        </div>

        {/* Progress bar */}
        {!loading && tasks.length > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1.5 font-medium">
              <span>Progress</span>
              <span>{completedCount}/{tasks.length}</span>
            </div>
            <div className="h-2 rounded-full bg-dark-700 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(completedCount / tasks.length) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-green"
              />
            </div>
          </div>
        )}

        {/* View toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === 'list'
                ? 'bg-neon-cyan/20 text-neon-cyan neon-border'
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <List size={14} />
            List
          </button>
          <button
            onClick={() => setView('map')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              view === 'map'
                ? 'bg-neon-cyan/20 text-neon-cyan neon-border'
                : 'glass text-gray-400 hover:text-white'
            }`}
          >
            <MapIcon size={14} />
            Map
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-neon-cyan" size={32} />
        </div>
      ) : view === 'map' ? (
        <div className="max-w-lg mx-auto w-full px-4 pb-4">
          <div className="rounded-2xl overflow-hidden neon-border" style={{ height: 450 }}>
            <TaskMap
              tasks={tasks}
              config={config}
              onTaskClick={(taskId) => navigate(`/task/${taskId}`)}
            />
          </div>
        </div>
      ) : (
        <div className="px-4 pb-4 max-w-lg mx-auto w-full">
          <div className="space-y-3">
            {tasks.map((task, i) => (
              <motion.div
                key={task._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <button
                  onClick={() => navigate(`/task/${task._id}`)}
                  className={`block w-full text-left glass rounded-2xl p-4 ${statusColors[task.status]} transition-all active:scale-[0.98]`}
                >
                  <div className="flex items-start gap-3">
                    {/* Queue position badge */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center text-sm font-bold text-neon-cyan">
                      {task.queuePosition || task.order || i + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-white text-sm truncate">{task.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge[task.status].color}`}>
                          {statusBadge[task.status].label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin size={12} />
                        <span className="truncate">{task.locationHint}</span>
                      </div>

                      {task.status === 'completed' && task.elapsedMs && (
                        <div className="flex items-center gap-1.5 text-xs text-neon-green mt-1">
                          <Clock size={12} />
                          <span>{formatMs(task.elapsedMs)}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-gray-600 flex-shrink-0 mt-2">
                      {task.status === 'completed' ? (
                        <CheckCircle2 size={18} className="text-neon-green" />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6"/>
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
