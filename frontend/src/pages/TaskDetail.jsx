import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Eye,
  Camera,
  CheckCircle2,
  Loader2,
  Clock,
  Sparkles,
  Play,
  Navigation,
} from 'lucide-react';
import api from '../api/axios';
import useTimer from '../hooks/useTimer';
import toast from 'react-hot-toast';

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [taskStats, setTaskStats] = useState({ completedCount: 0, activeCount: 0 });
  const [submission, setSubmission] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [locationRevealed, setLocationRevealed] = useState(false);
  const [preview, setPreview] = useState(null);
  const [submissionPhotoObjectUrl, setSubmissionPhotoObjectUrl] = useState(null);

  const fileRef = useRef(null);

  // Task has been started (submission exists with riddleOpenedAt)
  const hasStarted = !!submission;
  const isRunning = submission?.status === 'in-progress';
  const completed = submission?.status === 'completed';
  const blocked = submission?.status === 'blocked';
  const { formatted: timerDisplay } = useTimer(submission?.riddleOpenedAt, isRunning);
  const displayedImageUrl = preview || submissionPhotoObjectUrl || submission?.photoUrl || null;

  // Config-based reveal delays (in ms)
  const hintDelayMs = (config?.hintRevealDelaySec || 180) * 1000;
  const locDelayMs = (config?.locationRevealDelaySec || 360) * 1000;

  // ── Load task + config ────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get(`/tasks/${id}`),
      api.get('/config'),
    ])
      .then(([taskRes, configRes]) => {
        setTask(taskRes.data.task);
        setTaskStats(taskRes.data.taskStats || { completedCount: 0, activeCount: 0 });
        setSubmission(taskRes.data.submission);
        setConfig(configRes.data);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load task');
        setLoading(false);
      });
  }, [id]);

  // ── Auto-reveal timers ────────────────────────────────
  useEffect(() => {
    if (!submission?.riddleOpenedAt || completed) return;

    const startTime = new Date(submission.riddleOpenedAt).getTime();

    function checkReveals() {
      const elapsed = Date.now() - startTime;
      if (elapsed >= hintDelayMs) setHintRevealed(true);
      if (elapsed >= locDelayMs) setLocationRevealed(true);
    }

    // Check immediately
    checkReveals();

    // Poll every second if either hasn't been revealed yet
    const interval = setInterval(() => {
      checkReveals();
    }, 1000);

    return () => clearInterval(interval);
  }, [submission?.riddleOpenedAt, completed, hintDelayMs, locDelayMs]);

  // ── Re-fetch task when location should be revealed (to get lat/lng from server) ──
  useEffect(() => {
    if (locationRevealed && task && !task.lat) {
      api.get(`/tasks/${id}`).then(({ data }) => {
        setTask(data.task);
      }).catch(() => {});
    }
  }, [locationRevealed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load authenticated submission image blob for reliable rendering ──
  useEffect(() => {
    let active = true;
    let objectUrl = null;

    async function loadSubmissionPhoto() {
      if (!submission?.photoEndpoint) {
        setSubmissionPhotoObjectUrl(null);
        return;
      }

      try {
        const response = await api.get(submission.photoEndpoint, { responseType: 'blob' });
        objectUrl = URL.createObjectURL(response.data);
        if (active) setSubmissionPhotoObjectUrl(objectUrl);
      } catch (_err) {
        if (active) setSubmissionPhotoObjectUrl(null);
      }
    }

    loadSubmissionPhoto();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [submission?.photoEndpoint]);

  // ── Start Task → creates submission & starts timer ─────
  const handleStart = async () => {
    setStarting(true);
    try {
      const { data } = await api.post(`/tasks/${id}/start`);
      setTask(data.task);
      setTaskStats(data.taskStats || { completedCount: 0, activeCount: 0 });
      setSubmission(data.submission);
      toast.success('Timer started! Go find it!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start task');
    } finally {
      setStarting(false);
    }
  };

  // ── Handle photo selection & upload ───────────────────
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const form = new FormData();
      form.append('photo', file);

      const { data } = await api.post(`/submissions/${id}/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSubmission(data.submission);
      setPreview(null);
      setTaskStats(data.taskStats || { completedCount: 0, activeCount: 0 });
      toast.success(`Submitted in ${formatMs(data.submission.elapsedMs)}!`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  // ── Countdown text helper ─────────────────────────────
  function getCountdown(delayMs) {
    if (!submission?.riddleOpenedAt) return '';
    const elapsed = Date.now() - new Date(submission.riddleOpenedAt).getTime();
    const remaining = Math.max(0, Math.ceil((delayMs - elapsed) / 1000));
    if (remaining <= 0) return '';
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-neon-cyan" size={32} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400">Task not found</p>
        <button onClick={() => navigate('/')} className="text-neon-cyan text-sm font-semibold">
          ← Back to tasks
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* ── Top bar ──────────────────────────────────────── */}
      <div className="sticky top-0 z-30 glass-strong px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={18} />
          <span className="font-medium">Back</span>
        </button>

        {/* Live timer – only show if task has been started */}
        {hasStarted && (
          <div className={`flex items-center gap-1.5 text-sm font-mono font-bold ${
            blocked ? 'text-red-400' : completed ? 'text-neon-green' : 'text-neon-cyan neon-glow'
          }`}>
            <Clock size={14} />
            <span>{completed ? formatMs(submission.elapsedMs) : blocked ? 'Blocked' : timerDisplay}</span>
          </div>
        )}
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* ── Task header ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center gap-2 text-xs text-gray-500 font-semibold uppercase tracking-widest">
            <MapPin size={12} />
            {task.locationHint}
          </div>
          <h1 className="text-2xl font-black text-white leading-tight">{task.title}</h1>
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neon-gold/10 text-neon-gold text-xs font-bold">
            <Sparkles size={12} />
            {task.points} pts
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className="glass rounded-2xl p-4 neon-border">
            <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-1">Finished</div>
            <div className="text-2xl font-black text-neon-green">{taskStats.completedCount}</div>
            <div className="text-xs text-gray-400 mt-1">teams already completed this task</div>
          </div>
          <div className="glass rounded-2xl p-4 neon-border-pink">
            <div className="text-[10px] text-gray-500 font-semibold uppercase tracking-widest mb-1">Active Now</div>
            <div className="text-2xl font-black text-neon-pink">{taskStats.activeCount}</div>
            <div className="text-xs text-gray-400 mt-1">teams currently working on it</div>
          </div>
        </motion.div>

        {/* ── PRE-START: Show "Start Task" button ────────── */}
        {!hasStarted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="glass rounded-2xl p-5 neon-border text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-neon-cyan/20 to-neon-pink/20 flex items-center justify-center">
                <Play className="text-neon-cyan" size={28} />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Ready?</h2>
              <p className="text-sm text-gray-400 mb-1">
                The timer starts when you press the button below.
              </p>
              <p className="text-xs text-gray-500">
                You'll see the full task description after starting.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              disabled={starting}
              className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide bg-gradient-to-r from-neon-cyan to-cyan-400 text-dark-900 shadow-neon hover:shadow-neon flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {starting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Play size={20} />
              )}
              {starting ? 'Starting...' : 'Start Task'}
            </motion.button>
          </motion.div>
        )}

        {/* ── POST-START: Riddle + Hint + Location + Camera ── */}
        {hasStarted && (
          <>
            {/* Riddle card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-5 neon-border"
            >
              <h2 className="text-xs font-semibold text-neon-cyan uppercase tracking-widest mb-3">
                Your Mission
              </h2>
              <p className="text-gray-300 text-sm leading-relaxed">{task.description}</p>
            </motion.div>

            {/* Hint section — auto-reveals after hintRevealDelaySec */}
            {task.detailedHint && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <AnimatePresence mode="wait">
                  {!hintRevealed ? (
                    <motion.div
                      key="hint-locked"
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass rounded-2xl p-4 neon-border-pink"
                    >
                      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-neon-pink">
                        <Eye size={16} />
                        <span>Hint unlocks in {getCountdown(hintDelayMs) || '...'}</span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="hint-content"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="glass rounded-2xl p-5 neon-border-pink"
                    >
                      <h3 className="text-xs font-semibold text-neon-pink uppercase tracking-widest mb-2">
                        Hint
                      </h3>
                      <p className="text-gray-300 text-sm leading-relaxed">{task.detailedHint}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Location reveal — shown after locationRevealDelaySec */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              {!locationRevealed ? (
                <div className="glass rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-500">
                    <Navigation size={16} />
                    <span>Location unlocks in {getCountdown(locDelayMs) || '...'}</span>
                  </div>
                </div>
              ) : task.lat && task.lng ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${task.lat},${task.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass rounded-2xl p-4 neon-border flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-xl bg-neon-cyan/10 flex items-center justify-center flex-shrink-0">
                    <Navigation className="text-neon-cyan" size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neon-cyan uppercase tracking-widest">Location Revealed!</p>
                    <p className="text-sm text-gray-400 mt-0.5">Tap to open in Maps</p>
                  </div>
                </a>
              ) : (
                <div className="glass rounded-2xl p-4 border border-neon-cyan/20">
                  <div className="flex items-center justify-center gap-2 text-sm font-semibold text-neon-cyan">
                    <Navigation size={16} />
                    <span>Location revealed — no coordinates set</span>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Photo upload / preview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="space-y-3"
            >
              {displayedImageUrl && (
                <div className="relative rounded-2xl overflow-hidden neon-border">
                  <img
                    src={displayedImageUrl}
                    alt="Submission"
                    className="w-full aspect-[4/3] object-cover"
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-dark-900/70 flex items-center justify-center">
                      <Loader2 className="animate-spin text-neon-cyan" size={36} />
                    </div>
                  )}
                  {completed && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-neon-green/20 text-neon-green rounded-full px-3 py-1 text-xs font-bold backdrop-blur-sm">
                      <CheckCircle2 size={14} />
                      Submitted
                    </div>
                  )}
                </div>
              )}

              {blocked && (
                <div className="glass rounded-2xl p-5 border border-red-500/30 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="text-red-400 text-xl font-bold">✕</span>
                  </div>
                  <p className="text-red-400 font-bold text-sm mb-1">Submission Blocked</p>
                  <p className="text-gray-500 text-xs">Your photo was blocked by an admin. You cannot re-upload for this task.</p>
                </div>
              )}

              {!completed && !blocked && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide bg-gradient-to-r from-neon-cyan to-neon-pink text-white shadow-neon flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  >
                    <Camera size={20} />
                    {uploading ? 'Uploading...' : preview ? 'Choose Different Photo' : 'Take or Choose Photo'}
                  </motion.button>
                </>
              )}

              {(completed || blocked) && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => navigate('/')}
                  className="w-full py-4 rounded-2xl font-bold text-sm tracking-wide glass neon-border text-neon-cyan flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={18} />
                  Back to Tasks
                </motion.button>
              )}
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}

function formatMs(ms) {
  if (!ms) return '00:00';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}
