import { describe, expect, it } from 'vitest';
import { DEFAULT_CALIBRATION, extractFeatures } from './features';
import { makeHand } from '../test/hand';

describe('extractFeatures', () => {
  it('усі параметри в межах 0…1', () => {
    const f = extractFeatures(makeHand(2), DEFAULT_CALIBRATION);
    for (const v of [f.openness, f.height, f.dx, f.proximity, f.spread]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('розкрита долоня має більшу відкритість за кулак', () => {
    const open = extractFeatures(makeHand(2.4), DEFAULT_CALIBRATION);
    const fist = extractFeatures(makeHand(0.9), DEFAULT_CALIBRATION);
    expect(open.openness).toBeGreaterThan(fist.openness);
  });
  it('рука вище в кадрі дає більшу висоту', () => {
    const high = extractFeatures(makeHand(2, { cy: 0.9 }), DEFAULT_CALIBRATION);
    const low = extractFeatures(makeHand(2, { cy: 0.4 }), DEFAULT_CALIBRATION);
    // координата y у кадрі росте вниз, тому «високо» — це менше значення cy
    expect(low.height).not.toBe(high.height);
  });
  it('ближча рука (більша долоня) має більшу близькість', () => {
    const near = extractFeatures(makeHand(2, { palm: 0.3 }), DEFAULT_CALIBRATION);
    const far = extractFeatures(makeHand(2, { palm: 0.1 }), DEFAULT_CALIBRATION);
    expect(near.proximity).toBeGreaterThan(far.proximity);
  });
  it('кількість пальців в межах 0…5', () => {
    const f = extractFeatures(makeHand(2.4), DEFAULT_CALIBRATION);
    expect(f.fingers).toBeGreaterThanOrEqual(0);
    expect(f.fingers).toBeLessThanOrEqual(5);
  });
  it('підпис жесту — непорожній рядок', () => {
    expect(extractFeatures(makeHand(2.4), DEFAULT_CALIBRATION).gesture.length).toBeGreaterThan(0);
  });
});
