import axios from 'axios';

const api = axios.create({
  baseURL: 'https://backend-kwm-faf8fxg5ckewb2b6.northeurope-01.azurewebsites.net/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401 (but NOT on the login page — let it show the error)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/login')) {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('team');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
