import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [team, setTeam] = useState(() => {
    const saved = sessionStorage.getItem('team');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (name, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { name, password });
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('team', JSON.stringify(data.team));
      setTeam(data.team);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name, password) => {
    // Registration disabled – admin creates teams. Kept for API compatibility.
    throw new Error('Self-registration is disabled. Ask the admin to create your team.');
  };

  const updateProfile = async (name, password) => {
    setLoading(true);
    try {
      const { data } = await api.put('/auth/profile', { name, password });
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('team', JSON.stringify(data.team));
      setTeam(data.team);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('team');
    setTeam(null);
  };

  // Update current team's name
  const updateName = async (newName) => {
    setLoading(true);
    try {
      const { data } = await api.put('/auth/name', { name: newName });
      if (data.token) sessionStorage.setItem('token', data.token);
      if (data.team) {
        sessionStorage.setItem('team', JSON.stringify(data.team));
        setTeam(data.team);
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ team, login, register, updateProfile, updateName, logout, loading, isAuthenticated: !!team }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
