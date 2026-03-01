// ──────────────────────────────────────────────────────────────
// Admin Task Manager – CRUD with confirmation dialogs + map
// Admin can click on map to set task lat/lng
// ──────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Trash2,
  MapPin,
  Save,
  X,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  List,
} from 'lucide-react';
import api from '../../api/axios';
import toast from 'react-hot-toast';
import TaskMap from '../../components/TaskMap';
import { ConfirmModal } from '../../components/ConfirmModal';

const emptyTask = {
  title: '',
  description: '',
  locationHint: '',
  detailedHint: '',
  points: 100,
  order: 0,
  lat: '',
  lng: '',
  mapLabel: '',
  isActive: true,
};

// ── Confirmation Modal ── imported from ConfirmModal.jsx ──────

export default function AdminTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | 'new' | task._id
  const [form, setForm] = useState({ ...emptyTask });
  const [originalForm, setOriginalForm] = useState({ ...emptyTask });
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState('list'); // 'list' | 'map'

  // Confirmation modal state
  const [confirm, setConfirm] = useState({ open: false, type: null, taskId: null });

  const loadTasks = useCallback(() => {
    Promise.all([
      api.get('/admin/tasks'),
      api.get('/admin/config'),
    ]).then(([tasksRes, configRes]) => {
      setTasks(tasksRes.data);
      setConfig(configRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── Map click handler: set lat/lng on editing task ─────────
  const handleMapClick = ({ lat, lng }) => {
    if (editing && editing !== 'new') {
      const newLat = parseFloat(lat.toFixed(6));
      const newLng = parseFloat(lng.toFixed(6));
      // Update form + local markers immediately
      setForm((f) => ({ ...f, lat: String(newLat), lng: String(newLng) }));
      setTasks((prev) =>
        prev.map((t) =>
          t._id === editing ? { ...t, lat: newLat, lng: newLng } : t
        )
      );
      // Immediately ask to confirm & save the move
      setConfirm({ open: true, type: 'save', taskId: editing });
    } else if (editing === 'new') {
      setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
      toast.success(`Location set: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } else {
      toast('Select a task below first, then click the map to move it', { icon: '📍' });
    }
  };

  // ── Open edit panel by clicking a task row ─────────────────
  const handleClickTask = (task) => {
    if (editing === task._id) {
      handleCancel();
      return;
    }
    const formData = {
      title: task.title,
      description: task.description,
      locationHint: task.locationHint,
      detailedHint: task.detailedHint || '',
      points: task.points,
      order: task.order,
      lat: task.lat || '',
      lng: task.lng || '',
      mapLabel: task.mapLabel || '',
      isActive: task.isActive,
    };
    setEditing(task._id);
    setForm(formData);
    setOriginalForm(formData);
  };

  const handleNew = () => {
    const formData = { ...emptyTask, order: tasks.length + 1 };
    setEditing('new');
    setForm(formData);
    setOriginalForm(formData);
  };

  const handleCancel = () => {
    setEditing(null);
    setForm({ ...emptyTask });
    setOriginalForm({ ...emptyTask });
  };

  const hasChanges = () => JSON.stringify(form) !== JSON.stringify(originalForm);

  // ── Save: confirm if editing existing task ─────────────────
  const handleSaveClick = () => {
    if (!form.title || !form.description || !form.locationHint) {
      toast.error('Title, description, and location hint are required');
      return;
    }
    if (editing === 'new') {
      doSave();
    } else {
      setConfirm({ open: true, type: 'save', taskId: editing });
    }
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        points: parseInt(form.points) || 100,
        order: parseInt(form.order) || 0,
      };

      if (editing === 'new') {
        await api.post('/admin/tasks', payload);
        toast.success('Task created!');
      } else {
        await api.put(`/admin/tasks/${editing}`, payload);
        toast.success('Task updated!');
      }
      handleCancel();
      loadTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
      setConfirm({ open: false, type: null, taskId: null });
    }
  };

  // ── Delete: always confirm ─────────────────────────────────
  const handleDeleteClick = (e, taskId) => {
    e.stopPropagation();
    setConfirm({ open: true, type: 'delete', taskId });
  };

  const doDelete = async () => {
    setSaving(true);
    try {
      await api.delete(`/admin/tasks/${confirm.taskId}`);
      toast.success('Task deleted');
      if (editing === confirm.taskId) handleCancel();
      loadTasks();
    } catch (err) {
      toast.error('Failed to delete');
    } finally {
      setSaving(false);
      setConfirm({ open: false, type: null, taskId: null });
    }
  };

  const handleConfirmAction = () => {
    if (confirm.type === 'delete') doDelete();
    else if (confirm.type === 'save') doSave();
  };

  const closeConfirm = () => {
    // If cancelling a save, revert form & marker to original position
    if (confirm.type === 'save') {
      setForm({ ...originalForm });
      setTasks((prev) =>
        prev.map((t) =>
          t._id === editing
            ? { ...t, lat: parseFloat(originalForm.lat) || t.lat, lng: parseFloat(originalForm.lng) || t.lng }
            : t
        )
      );
    }
    setConfirm({ open: false, type: null, taskId: null });
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const taskToDelete = confirm.type === 'delete'
    ? tasks.find((t) => t._id === confirm.taskId)
    : null;

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/admin')} className="text-gray-400 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-black text-white">Tasks</h1>
          <span className="text-xs text-gray-500 ml-1">({tasks.length})</span>
        </div>
        <button
          onClick={handleNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neon-cyan/20 text-neon-cyan text-xs font-bold hover:bg-neon-cyan/30 transition-colors"
        >
          <Plus size={14} />
          Add Task
        </button>
      </div>

      {/* View toggle: List / Map */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            view === 'list'
              ? 'bg-neon-cyan/20 text-neon-cyan neon-border'
              : 'glass text-gray-400 hover:text-white'
          }`}
        >
          <List size={14} /> List
        </button>
        <button
          onClick={() => setView('map')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            view === 'map'
              ? 'bg-neon-cyan/20 text-neon-cyan neon-border'
              : 'glass text-gray-400 hover:text-white'
          }`}
        >
          <MapIcon size={14} /> Map
        </button>
        {editing && view === 'map' && (
          <span className="text-[10px] text-neon-gold self-center ml-2 animate-pulse">
            📍 Editing "{form.title || 'New Task'}" — click map to set location or type coordinates below
          </span>
        )}
        {!editing && view === 'map' && (
          <span className="text-[10px] text-gray-500 self-center ml-2">
            Select a task below, then click map to set location
          </span>
        )}
      </div>

      {/* Map view */}
      {view === 'map' && config && (
        <div className="mb-6 rounded-2xl overflow-hidden neon-border relative z-0 isolate" style={{ height: 450 }}>
          <TaskMap
            tasks={tasks}
            config={config}
            onTaskClick={() => {}}
            onMapClick={handleMapClick}
            adminMode
          />
        </div>
      )}

      {/* New task form (shown at top) */}
      <AnimatePresence>
        {editing === 'new' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-2xl p-5 neon-border mb-6 space-y-3"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-neon-cyan">New Task</h2>
              <button onClick={handleCancel} className="text-gray-500 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <TaskForm form={form} updateField={updateField} />

            <button
              onClick={doSave}
              disabled={saving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-neon-cyan to-cyan-400 text-dark-900 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-neon-cyan" size={32} />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500 text-sm mb-4">No tasks yet</p>
          <button
            onClick={handleNew}
            className="px-4 py-2 rounded-xl bg-neon-cyan/20 text-neon-cyan text-sm font-bold hover:bg-neon-cyan/30"
          >
            Create your first task
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div key={task._id}>
              {/* Task row – click to expand edit */}
              <div
                onClick={() => handleClickTask(task)}
                className={`glass rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all
                  ${editing === task._id
                    ? 'border border-neon-cyan/40 ring-1 ring-neon-cyan/20 rounded-b-none'
                    : task.isActive
                      ? 'border border-white/5 hover:border-white/15'
                      : 'border border-red-500/20 opacity-60 hover:opacity-80'
                  }`}
              >
                <div className="w-8 h-8 rounded-lg bg-dark-700 flex items-center justify-center text-xs font-bold text-neon-cyan shrink-0">
                  {task.order}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">{task.title}</h3>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>{task.points} pts</span>
                    {task.lat && task.lng && (
                      <span className="flex items-center gap-0.5 text-neon-green">
                        <MapPin size={8} /> GPS
                      </span>
                    )}
                    {!task.isActive && <span className="text-red-400">Hidden</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {editing === task._id ? (
                    <ChevronUp size={16} className="text-neon-cyan" />
                  ) : (
                    <ChevronDown size={16} className="text-gray-600" />
                  )}
                </div>
              </div>

              {/* Inline edit form below the row */}
              <AnimatePresence>
                {editing === task._id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="glass rounded-b-2xl p-5 border border-neon-cyan/20 border-t-0 space-y-3">
                      <TaskForm form={form} updateField={updateField} />
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={handleCancel}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-white/10 text-gray-400 hover:bg-white/5 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, task._id)}
                          className="py-2.5 px-4 rounded-xl text-sm font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
                          title="Delete task"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                        <button
                          onClick={handleSaveClick}
                          disabled={saving || !hasChanges()}
                          className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-neon-cyan to-cyan-400 text-dark-900 flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
                        >
                          {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                          {saving ? 'Saving...' : 'Save Changes'}
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

      {/* Confirmation modals */}
      <ConfirmModal
        open={confirm.open && confirm.type === 'delete'}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.title || 'this task'}"? All submissions for this task will also be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
        onConfirm={handleConfirmAction}
        onCancel={closeConfirm}
        loading={saving}
      />
      <ConfirmModal
        open={confirm.open && confirm.type === 'save'}
        title="Save Changes"
        message="Are you sure you want to save changes to this task? This will update the task for all teams."
        confirmLabel="Save"
        confirmColor="cyan"
        onConfirm={handleConfirmAction}
        onCancel={closeConfirm}
        loading={saving}
      />
    </div>
  );
}

// ── Shared form fields ───────────────────────────────────────
function TaskForm({ form, updateField }) {
  return (
    <>
      <Input label="Title" value={form.title} onChange={(v) => updateField('title', v)} />
      <TextArea
        label="Description (Riddle)"
        value={form.description}
        onChange={(v) => updateField('description', v)}
        rows={4}
      />
      <Input label="Location Hint" value={form.locationHint} onChange={(v) => updateField('locationHint', v)} />
      <TextArea
        label="Detailed Hint (tip revealed on request)"
        value={form.detailedHint}
        onChange={(v) => updateField('detailedHint', v)}
        rows={2}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input label="Points" type="number" value={form.points} onChange={(v) => updateField('points', v)} />
        <Input label="Order" type="number" value={form.order} onChange={(v) => updateField('order', v)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Latitude" type="number" value={form.lat} onChange={(v) => updateField('lat', v)} placeholder="52.2297" />
        <Input label="Longitude" type="number" value={form.lng} onChange={(v) => updateField('lng', v)} placeholder="21.0122" />
      </div>

      <Input label="Map Label (short)" value={form.mapLabel} onChange={(v) => updateField('mapLabel', v)} placeholder="e.g. A1" />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => updateField('isActive', e.target.checked)}
          className="w-4 h-4 rounded bg-dark-700 border-white/10"
        />
        <span className="text-xs text-gray-400">Active (visible to teams)</span>
      </div>
    </>
  );
}

// ── Reusable inputs ──────────────────────────────────────────
function Input({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={type === 'number' ? 'any' : undefined}
        className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-neon-cyan/50"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3 }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 block">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-neon-cyan/50 resize-none"
      />
    </div>
  );
}
