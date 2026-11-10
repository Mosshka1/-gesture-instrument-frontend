// Допоміжне: штучна «рука» з 21 точки для перевірки жестів без камери
import type { Landmarks } from '../audio/features';

/** reach — відстань кінчиків пальців від зап'ястя в розмірах долоні (≈0.9 кулак, ≈2.3 розкрита долоня) */
export function makeHand(reach: number, opts: { cx?: number; cy?: number; palm?: number } = {}): Landmarks {
  const { cx = 0.5, cy = 0.7, palm = 0.2 } = opts;
  const lm: Landmarks = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));
  lm[0] = { x: cx, y: cy, z: 0 }; // зап'ястя
  lm[9] = { x: cx, y: cy - palm, z: 0 }; // основа середнього пальця: задає розмір долоні
  lm[5] = { x: cx - palm * 0.4, y: cy - palm * 0.9, z: 0 };
  lm[17] = { x: cx + palm * 0.4, y: cy - palm * 0.9, z: 0 };
  const tipIdx = [4, 8, 12, 16, 20];
  tipIdx.forEach((i, k) => {
    // кінчики лежать на дузі навколо зап'ястя, тому відстань до нього дорівнює reach × розмір долоні
    const a = (k - 2) * 0.3;
    lm[i] = { x: cx + Math.sin(a) * palm * reach, y: cy - Math.cos(a) * palm * reach, z: 0 };
  });
  return lm;
}
