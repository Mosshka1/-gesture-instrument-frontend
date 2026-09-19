import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
});

export async function registerUser(fullName: string, email: string, password: string) {
  const response = await api.post('/auth/register', { fullName, email, password });
  return response.data;
}

export async function loginUser(email: string, password: string) {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
}

export async function getPresets() {
  const token = localStorage.getItem('token');
  const response = await api.get('/presets', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.presets;
}

export async function createPreset(name: string, soundType: string, settings: object = {}) {
  const token = localStorage.getItem('token');
  const response = await api.post(
    '/presets',
    { name, soundType, settings },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data.preset;
}

export async function deletePreset(id: number) {
  const token = localStorage.getItem('token');
  await api.delete(`/presets/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export default api;