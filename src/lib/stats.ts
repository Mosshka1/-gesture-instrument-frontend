import { getStoredUser } from './format';

// Статистика гри зберігається лише в браузері, окремо для кожного акаунта
export type PlayStats = {
  playSeconds: number; // скільки рука була в кадрі й звучав інструмент
  sessions: number;
  modeSeconds: Record<string, number>;
  maxLayers: number; // найбільше шарів у лупері
  unlocked: string[]; // досягнення, про які вже повідомили
};

const empty = (): PlayStats => ({ playSeconds: 0, sessions: 0, modeSeconds: {}, maxLayers: 0, unlocked: [] });

const key = () => `gs:stats:${getStoredUser()?.id ?? 'guest'}`;

export function loadStats(): PlayStats {
  try {
    const raw = localStorage.getItem(key());
    if (!raw) return empty();
    const p = JSON.parse(raw);
    return {
      playSeconds: Number(p.playSeconds) || 0,
      sessions: Number(p.sessions) || 0,
      modeSeconds: p.modeSeconds && typeof p.modeSeconds === 'object' ? p.modeSeconds : {},
      maxLayers: Number(p.maxLayers) || 0,
      unlocked: Array.isArray(p.unlocked) ? p.unlocked : [],
    };
  } catch {
    return empty();
  }
}

export function saveStats(s: PlayStats) {
  try {
    localStorage.setItem(key(), JSON.stringify(s));
  } catch {
    // сховище недоступне — статистика просто не збережеться
  }
}

export function clearStats() {
  try {
    localStorage.removeItem(key());
  } catch {
    // ігноруємо
  }
}

export function formatPlayTime(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 1) return `${Math.round(sec)} с`;
  if (m < 60) return `${m} хв`;
  const h = Math.floor(m / 60);
  return `${h} год ${m % 60} хв`;
}
