// Перетворення 21 точки руки (MediaPipe) на зрозумілі музичні параметри

import { distance, mapRange } from '../utils/gestureChecks';
import { clamp01 } from './music';

export type Landmark = { x: number; y: number; z: number };
export type Landmarks = Landmark[];

export type Calibration = {
  sensitivity: number; // 0–100
  smoothing: number; // 0–100
  confidence: number; // 0–100
  palmRatio: number; // відкритість "розкритої долоні"
  fistRatio: number; // відкритість "кулака"
  sizeFar: number; // розмір долоні, коли рука далеко
  sizeNear: number; // розмір долоні, коли рука близько
  calibrated: boolean;
  calibratedAt?: string;
};

export const DEFAULT_CALIBRATION: Calibration = {
  sensitivity: 60,
  smoothing: 40,
  confidence: 60,
  palmRatio: 2.3,
  fistRatio: 1.15,
  sizeFar: 0.12,
  sizeNear: 0.3,
  calibrated: false,
};

export type Features = {
  openness: number; // 0 кулак … 1 розкрита долоня
  height: number; // 0 низько … 1 високо
  dx: number; // 0 ліво … 1 право (так, як бачить користувач на екрані)
  proximity: number; // 0 далеко … 1 близько до камери
  spread: number; // розведення пальців 0…1
  tilt: number; // нахил -1…1
  fingers: number; // кількість випрямлених пальців 0…5
  pinch: number[]; // відстань великий↔вказівний/середній/безіменний/мізинець (у розмірах долоні)
  peace: boolean;
  rawX: number; // положення центру долоні в "сирих" координатах 0…1
  rawY: number;
  size: number;
  gesture: string;
};

function expand(v: number, cal: Calibration) {
  // чутливість: чим вища, тим менше треба рухати рукою, щоб пройти весь діапазон
  const gain = 0.6 + (cal.sensitivity / 100) * 1.0;
  return clamp01(0.5 + (v - 0.5) * gain);
}

export function extractFeatures(lm: Landmarks, cal: Calibration): Features {
  const wrist = lm[0];
  const size = distance(wrist, lm[9]) || 0.1;

  const tips = [4, 8, 12, 16, 20].map((i) => lm[i]);
  const avgTip = tips.reduce((sum, t) => sum + distance(t, wrist), 0) / tips.length;
  const ratio = avgTip / size;

  const openness = clamp01(mapRange(ratio, cal.fistRatio, Math.max(cal.palmRatio, cal.fistRatio + 0.2), 0, 1));
  const proximity = clamp01(mapRange(size, cal.sizeFar, Math.max(cal.sizeNear, cal.sizeFar + 0.03), 0, 1));

  const rawX = lm[9].x;
  const rawY = lm[9].y;
  const height = expand(mapRange(rawY, 0.1, 0.9, 1, 0), cal);
  const dx = expand(mapRange(1 - rawX, 0.1, 0.9, 0, 1), cal);

  const spread = clamp01(mapRange(distance(lm[4], lm[20]) / size, 0.5, 2.2, 0, 1));

  const angle = Math.atan2(lm[17].y - lm[5].y, lm[17].x - lm[5].x);
  const tilt = mapRange(angle, -Math.PI / 2, Math.PI / 2, -1, 1);

  const extended = (tip: number, pip: number) => distance(lm[tip], wrist) > distance(lm[pip], wrist) * 1.12;
  let fingers = 0;
  if (extended(8, 6)) fingers++;
  if (extended(12, 10)) fingers++;
  if (extended(16, 14)) fingers++;
  if (extended(20, 18)) fingers++;
  if (distance(lm[4], lm[5]) / size > 0.75) fingers++;

  const pinch = [8, 12, 16, 20].map((t) => distance(lm[4], lm[t]) / size);

  const idxExt = distance(lm[8], wrist) / size > 1.7;
  const midExt = distance(lm[12], wrist) / size > 1.7;
  const ringCurl = distance(lm[16], wrist) / size < 1.45;
  const pinkyCurl = distance(lm[20], wrist) / size < 1.45;
  const peace = idxExt && midExt && ringCurl && pinkyCurl;

  let gesture = 'Рука в кадрі';
  if (pinch[0] < 0.55) gesture = 'Щипок';
  else if (peace) gesture = 'Перемога (V)';
  else if (fingers >= 5 || openness > 0.8) gesture = 'Відкрита долоня';
  else if (fingers === 0 || openness < 0.2) gesture = 'Кулак';
  else if (fingers === 1) gesture = 'Вказівний палець';
  else gesture = `Пальців: ${fingers}`;

  return { openness, height, dx, proximity, spread, tilt, fingers, pinch, peace, rawX, rawY, size, gesture };
}

// ---------- Відстеження швидкості рук ----------

export type Hand = {
  lm: Landmarks;
  f: Features;
  slot: number; // 0 — права рука користувача (ліворуч у "сирому" кадрі), 1 — ліва
  twoHands: boolean;
  palmSpeed: number; // швидкість центру долоні (екранів/с)
  palmVy: number; // вертикальна швидкість долоні (вниз — додатна)
  tipVy: number[]; // вертикальна швидкість кінчиків (вказ., сер., безім., мізинець)
};

export class HandTracker {
  private prev: Landmarks[] = [];
  private prevTime = 0;

  process(hands: Landmarks[], cal: Calibration, now: number): Hand[] {
    const sorted = [...hands].sort((a, b) => a[9].x - b[9].x);
    const dt = this.prevTime ? Math.max((now - this.prevTime) / 1000, 0.008) : 0;
    const sameCount = this.prev.length === sorted.length;

    const result = sorted.map((lm, slot) => {
      const f = extractFeatures(lm, cal);
      let palmSpeed = 0;
      let palmVy = 0;
      const tipVy = [0, 0, 0, 0];
      const old = sameCount ? this.prev[slot] : null;
      if (old && dt > 0) {
        const dxp = lm[9].x - old[9].x;
        const dyp = lm[9].y - old[9].y;
        palmSpeed = Math.sqrt(dxp * dxp + dyp * dyp) / dt;
        palmVy = dyp / dt;
        [8, 12, 16, 20].forEach((t, i) => {
          tipVy[i] = (lm[t].y - old[t].y) / dt;
        });
      }
      return { lm, f, slot, twoHands: sorted.length > 1, palmSpeed, palmVy, tipVy } as Hand;
    });

    this.prev = sorted;
    this.prevTime = now;
    return result;
  }

  reset() {
    this.prev = [];
    this.prevTime = 0;
  }
}
