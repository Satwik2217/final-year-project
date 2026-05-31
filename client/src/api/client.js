// Axios API client — attaches JWT token to all authenticated NeuroWell requests.
import axios from 'axios';

const API_URL = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('neurowell_token') || localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('neurowell_token', token);
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('neurowell_token');
    localStorage.removeItem('token');
    localStorage.removeItem('neurowell_user');
    localStorage.removeItem('userName');
  }
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('neurowell_user') || 'null');
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  localStorage.setItem('neurowell_user', JSON.stringify(user));
  if (user?.name) localStorage.setItem('userName', user.name);
}

export default api;
