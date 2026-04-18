import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// Auto-inject token into headers
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('valoraAdminToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const registerAdmin = (data) => api.post('/auth/admin-register', data);
export const loginAdmin = (data) => api.post('/auth/admin-login', data);

export default api;
