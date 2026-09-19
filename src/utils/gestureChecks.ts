export function distance(p1: any, p2: any) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  return ((clamped - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

function getHandSize(landmarks: any[]) {
  return distance(landmarks[0], landmarks[9]) || 0.1;
}

// Повертає "сире" число відкритості руки — саме його ми показуватимемо на екрані для калібрування
export function getOpennessRatio(landmarks: any[]): number {
  const wrist = landmarks[0];
  const handSize = getHandSize(landmarks);
  const tips = [4, 8, 12, 16, 20].map((i) => landmarks[i]);
  const avg = tips.reduce((sum, tip) => sum + distance(tip, wrist), 0) / tips.length;
  return avg / handSize;
}

export function isOpenPalm(landmarks: any[]): boolean {
  return getOpennessRatio(landmarks) > 1.6;
}

export function isFist(landmarks: any[]): boolean {
  return getOpennessRatio(landmarks) < 1.3;
}

export function isPeaceSign(landmarks: any[]): boolean {
  const wrist = landmarks[0];
  const handSize = getHandSize(landmarks);
  const indexExtended = distance(landmarks[8], wrist) / handSize > 1.7;
  const middleExtended = distance(landmarks[12], wrist) / handSize > 1.7;
  const ringCurled = distance(landmarks[16], wrist) / handSize < 1.4;
  const pinkyCurled = distance(landmarks[20], wrist) / handSize < 1.4;
  return indexExtended && middleExtended && ringCurled && pinkyCurled;
}

export function isPinch(landmarks: any[]): boolean {
  const handSize = getHandSize(landmarks);
  return distance(landmarks[4], landmarks[8]) / handSize < 0.6;
}

export function getTilt(landmarks: any[]): number {
  const angle = Math.atan2(
    landmarks[17].y - landmarks[5].y,
    landmarks[17].x - landmarks[5].x
  );
  return mapRange(angle, -Math.PI / 2, Math.PI / 2, -1, 1);
}