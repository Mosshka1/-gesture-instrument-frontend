import axios from 'axios';

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Токен підставляється автоматично до кожного запиту
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Якщо токен прострочений — повертаємо на сторінку входу (окрім самих запитів входу)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error?.config?.url || '';
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/google') || url.startsWith('/auth/register');
    if (error?.response?.status === 401 && !isAuthCall && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export type ApiUser = {
  id: number;
  fullName: string;
  email: string;
  createdAt?: string;
};

export type ApiPreset = {
  id: number;
  name: string;
  soundType: string;
  settings: Record<string, any>;
  favorite: boolean;
  usedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiRecording = {
  id: number;
  name: string;
  fileName: string;
  mode: string | null;
  durationSec: number | null;
  sizeBytes: number | null;
  createdAt: string;
};

export type ApiSound = {
  id: number;
  name: string;
  fileName: string;
  type: 'instrument' | 'background';
  author?: string | null;
  license?: string | null;
  sourceUrl?: string | null;
  createdAt: string;
};

export type FreesoundResult = {
  id: number;
  name: string;
  author: string;
  license: string;
  duration: number;
  previewUrl: string;
  url: string;
};

export function getErrorMessage(err: any, fallback = 'Щось пішло не так'): string {
  return err?.response?.data?.error || fallback;
}

// ---------- Авторизація ----------

export async function registerUser(fullName: string, email: string, password: string) {
  const response = await api.post('/auth/register', { fullName, email, password });
  return response.data;
}

export async function loginUser(email: string, password: string) {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
}

export async function loginWithGoogle(credential: string) {
  const response = await api.post('/auth/google', { credential });
  return response.data;
}

export async function getMe(): Promise<ApiUser> {
  const response = await api.get('/auth/me');
  return response.data.user;
}

export async function updateMe(fullName: string): Promise<ApiUser> {
  const response = await api.put('/auth/me', { fullName });
  return response.data.user;
}

// ---------- Налаштування / калібрування ----------

export async function getCalibration() {
  const response = await api.get('/settings');
  return response.data.calibration as Record<string, any> | null;
}

export async function saveCalibrationRemote(calibration: object) {
  await api.put('/settings', { calibration });
}

// ---------- Пресети ----------

export async function getPresets(): Promise<ApiPreset[]> {
  const response = await api.get('/presets');
  return response.data.presets;
}

export async function createPreset(name: string, soundType: string, settings: object = {}): Promise<ApiPreset> {
  const response = await api.post('/presets', { name, soundType, settings });
  return response.data.preset;
}

export async function updatePreset(
  id: number,
  data: { name?: string; soundType?: string; settings?: object; favorite?: boolean }
): Promise<ApiPreset> {
  const response = await api.put(`/presets/${id}`, data);
  return response.data.preset;
}

export async function markPresetUsed(id: number): Promise<ApiPreset> {
  const response = await api.post(`/presets/${id}/use`);
  return response.data.preset;
}

export async function deletePreset(id: number) {
  await api.delete(`/presets/${id}`);
}

// ---------- Записи ----------

export async function getRecordings(): Promise<ApiRecording[]> {
  const response = await api.get('/recordings');
  return response.data.recordings;
}

export async function uploadRecording(name: string, blob: Blob, mode?: string, durationSec?: number) {
  const formData = new FormData();
  formData.append('name', name);
  if (mode) formData.append('mode', mode);
  if (durationSec !== undefined) formData.append('durationSec', String(durationSec));
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  formData.append('audio', blob, `recording.${ext}`);

  const response = await api.post('/recordings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.recording as ApiRecording;
}

export async function renameRecording(id: number, name: string): Promise<ApiRecording> {
  const response = await api.put(`/recordings/${id}`, { name });
  return response.data.recording;
}

export async function deleteRecording(id: number) {
  await api.delete(`/recordings/${id}`);
}

// ---------- Власні звуки ----------

export async function getSounds(type?: 'instrument' | 'background'): Promise<ApiSound[]> {
  const response = await api.get('/sounds', { params: type ? { type } : {} });
  return response.data.sounds;
}

export async function uploadSound(name: string, type: 'instrument' | 'background', file: File): Promise<ApiSound> {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('type', type);
  formData.append('audio', file);
  const response = await api.post('/sounds', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.sound;
}

export async function deleteSound(id: number) {
  await api.delete(`/sounds/${id}`);
}

export function uploadUrl(fileName: string) {
  // звуки з Freesound зберігаються як "fs:<id>" і віддаються через бекенд
  if (fileName.startsWith('fs:')) return `${API_BASE_URL}/freesound/preview/${fileName.slice(3)}`;
  return `${API_BASE_URL}/uploads/${fileName}`;
}

export async function searchFreesound(q: string, page = 1) {
  const response = await api.get('/freesound/search', { params: { q, page } });
  return response.data as { results: FreesoundResult[]; count: number; hasMore: boolean };
}

export async function addFreesoundSound(r: FreesoundResult, type: 'instrument' | 'background'): Promise<ApiSound> {
  const response = await api.post('/sounds/freesound', {
    freesoundId: r.id,
    name: r.name.replace(/\.[a-z0-9]{2,4}$/i, ''),
    type,
    author: r.author,
    license: r.license,
    sourceUrl: r.url,
  });
  return response.data.sound;
}

export default api;
