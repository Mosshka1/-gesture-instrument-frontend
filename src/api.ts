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

export async function getMe() {
  const token = localStorage.getItem('token');
  const response = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.user;
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

export async function getRecordings() {
  const token = localStorage.getItem('token');
  const response = await api.get('/recordings', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data.recordings;
}

export async function uploadRecording(name: string, blob: Blob) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('name', name);
  formData.append('audio', blob, 'recording.webm');

  const response = await api.post('/recordings', formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data.recording;
}

export async function deleteRecording(id: number) {
  const token = localStorage.getItem('token');
  await api.delete(`/recordings/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export const API_BASE_URL = 'http://localhost:3000';

export default api;