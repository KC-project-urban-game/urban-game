import { Outlet, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { team, isAuthenticated, updateName: contextUpdateName, loading } = useAuth();
  const updateName = contextUpdateName || (() => {});
  const [renameError, setRenameError] = useState(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !team) return;
    // Show dialog if team name matches generated pattern like team123 and not dismissed for this team
    const isGenerated = /^team\d+$/i.test(String(team.name || ''));
    const teamKeyId = team.id || team._id || team.name;
    const key = `saw-rename-dialog:${teamKeyId}`;
    const dismissed = sessionStorage.getItem(key);
    if (isGenerated && !dismissed) setShowRenameDialog(true);
  }, [isAuthenticated, team]);

  const closeDialog = () => {
    if (team) {
      const teamKeyId = team.id || team._id || team.name;
      const key = `saw-rename-dialog:${teamKeyId}`;
      sessionStorage.setItem(key, '1');
    }
    setShowRenameDialog(false);
  };

  const [suggestedName, setSuggestedName] = useState('');

  useEffect(() => {
    if (team && team.name) setSuggestedName(team.name);
  }, [team]);

  // Prevent background scrolling while modal is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (showRenameDialog) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showRenameDialog]);

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto pb-20">
        <Outlet />
      </main>

      {/* Fixed bottom navigation */}
      <BottomNav />

      {/* First-login rename dialog */}
      {showRenameDialog && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2147483647 }}>
          <div className="w-full max-w-md bg-dark-900 rounded-2xl p-6 neon-border" style={{ zIndex: 2147483648 }}>
            <h3 className="text-lg font-bold text-white mb-2">Choose a team name</h3>
            <p className="text-sm text-gray-400 mb-4">We created a temporary name for your team. You can set a custom name now or change it later in your profile settings.</p>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Team name</label>
              <input
                value={suggestedName}
                onChange={(e) => setSuggestedName(e.target.value)}
                placeholder="Choose a team name"
                maxLength={40}
                className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-white/5 text-white text-sm focus:outline-none focus:border-neon-cyan/50"
              />
              {renameError && (
                <div className="text-sm text-red-400 mt-2">{renameError}</div>
              )}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={async () => {
                  if (!suggestedName || !suggestedName.trim()) return;
                  setRenameError(null);
                  try {
                    await updateName(suggestedName.trim());
                    // mark dismissed for this team and close
                    if (team) {
                      const teamKeyId = team.id || team._id || team.name;
                      const key = `saw-rename-dialog:${teamKeyId}`;
                      sessionStorage.setItem(key, '1');
                    }
                    setShowRenameDialog(false);
                  } catch (err) {
                    // surface useful message
                    const status = err?.response?.status;
                    if (status === 409) {
                      setRenameError('That team name is already taken.');
                    } else if (err?.response?.data?.error) {
                      setRenameError(err.response.data.error);
                    } else {
                      setRenameError('Failed to set team name. Try again.');
                    }
                    // keep dialog open for correction
                  }
                }}
                disabled={!!loading}
                className={`px-4 py-2 rounded-lg font-semibold ${loading ? 'bg-dark-700 opacity-60 cursor-wait' : 'bg-neon-cyan'}`}>
                {loading ? 'Saving…' : 'Set team name'}
              </button>
              <button onClick={closeDialog} className="px-4 py-2 bg-dark-800 rounded-lg">
                Change later in profile settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
