import { DEFAULT_CALIBRATION } from '../audio/features';
import type { Calibration } from '../audio/features';
import { getCalibration, saveCalibrationRemote } from '../api';

const KEY = 'calibration';

export function loadCachedCalibration(): Calibration {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_CALIBRATION, ...JSON.parse(raw) };
  } catch {
    // ігноруємо пошкоджений кеш
  }
  return { ...DEFAULT_CALIBRATION };
}

export async function fetchCalibration(): Promise<Calibration> {
  try {
    const remote = await getCalibration();
    const merged = { ...DEFAULT_CALIBRATION, ...(remote || {}) } as Calibration;
    localStorage.setItem(KEY, JSON.stringify(merged));
    return merged;
  } catch {
    return loadCachedCalibration();
  }
}

export async function persistCalibration(cal: Calibration) {
  localStorage.setItem(KEY, JSON.stringify(cal));
  await saveCalibrationRemote(cal);
}
