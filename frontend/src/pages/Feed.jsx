import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Loader2, Clock, MapPin } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatMs(ms) {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export default function Feed() {
  const [feed, setFeed] = useState([]);
  const [teamOptions, setTeamOptions] = useState([]);
  const [taskOptions, setTaskOptions] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [loading, setLoading] = useState(true);
  const { team } = useAuth();
  const objectUrlsRef = useRef([]);

  useEffect(() => {
    let active = true;

    async function loadFeed() {
      try {
        setLoading(true);

        // Revoke previously created object URLs before fetching a new filtered set.
        objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
        objectUrlsRef.current = [];

        const params = {};
        if (selectedTeamId) params.teamId = selectedTeamId;
        if (selectedTaskId) params.taskId = selectedTaskId;

        const { data } = await api.get('/submissions/feed', { params });
        const items = Array.isArray(data?.items) ? data.items : [];

        const withImages = await Promise.all(items.map(async (item) => {
          if (!item.photoEndpoint) {
            return { ...item, renderedPhotoUrl: null };
          }

          try {
            const response = await api.get(item.photoEndpoint, { responseType: 'blob' });
            const renderedPhotoUrl = URL.createObjectURL(response.data);
            objectUrlsRef.current.push(renderedPhotoUrl);
            return { ...item, renderedPhotoUrl };
          } catch (_err) {
            return { ...item, renderedPhotoUrl: null };
          }
        }));

        if (active) {
          setFeed(withImages);
          setTeamOptions(Array.isArray(data?.filters?.teams) ? data.filters.teams : []);
          setTaskOptions(Array.isArray(data?.filters?.tasks) ? data.filters.tasks : []);
          setLoading(false);
        }
      } catch (_err) {
        if (active) setLoading(false);
      }
    }

    loadFeed();

    return () => {
      active = false;
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, [selectedTeamId, selectedTaskId]);

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-2">
        <Camera className="text-neon-pink" size={22} />
        <h1 className="text-xl font-black text-white">Live Competition Feed</h1>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        You can see all teams' submissions. Other teams' photos are intentionally blurred.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <select
          value={selectedTaskId}
          onChange={(e) => setSelectedTaskId(e.target.value)}
          className="glass rounded-lg px-3 py-2 text-xs text-white border border-white/10 focus:outline-none focus:border-neon-cyan/50"
        >
          <option value="" className="bg-dark-900">All tasks</option>
          {taskOptions.map((t) => (
            <option key={t.id} value={t.id} className="bg-dark-900">
              {t.title}
            </option>
          ))}
        </select>

        <select
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          className="glass rounded-lg px-3 py-2 text-xs text-white border border-white/10 focus:outline-none focus:border-neon-cyan/50"
        >
          <option value="" className="bg-dark-900">All teams</option>
          {teamOptions.map((t) => (
            <option key={t.id} value={t.id} className="bg-dark-900">
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-neon-cyan" size={32} />
        </div>
      ) : feed.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Camera size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No photos yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-5 pb-6">
          {feed.map((item, i) => {
            const isOwner = String(item.team?._id || '') === String(team?.id || '');

            return (
              <motion.div
                key={item._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-2xl overflow-hidden neon-border"
              >
                {/* Team header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-dark-900"
                    style={{ backgroundColor: item.team?.avatarColor || '#00f0ff' }}
                  >
                    {item.team?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {item.team?.name || 'Unknown'}
                      {isOwner && (
                        <span className="text-neon-cyan ml-1 text-xs">(You)</span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      <span>{timeAgo(item.photoSubmittedAt)}</span>
                      {item.elapsedMs && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-0.5 text-neon-green">
                            <Clock size={10} />
                            {formatMs(item.elapsedMs)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Photo */}
                <div className="relative overflow-hidden">
                  {item.renderedPhotoUrl ? (
                    <img
                      src={item.renderedPhotoUrl}
                      alt={item.task?.title || 'Submission'}
                      className="w-full aspect-[4/3] object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-[4/3] bg-black/50 grid place-items-center text-xs text-gray-300">
                      Photo hidden
                    </div>
                  )}
                  {!isOwner && (
                    <div className="absolute inset-0 grid place-items-center pointer-events-none">
                      <div className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-black/65 text-white border border-white/20 backdrop-blur-sm tracking-wide uppercase">
                        Competitor photo blurred
                      </div>
                    </div>
                  )}
                </div>

                {/* Task info bar */}
                <div className="px-4 py-3 flex items-center gap-2 text-xs text-gray-400">
                  <MapPin size={12} className="text-neon-cyan" />
                  <span className="font-semibold text-white">{item.task?.title}</span>
                  <span className="text-gray-600">·</span>
                  <span className="truncate">{item.task?.locationHint}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
