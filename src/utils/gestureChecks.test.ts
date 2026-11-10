import { describe, expect, it } from 'vitest';
import { distance, getOpennessRatio, getTilt, isFist, isOpenPalm, isPeaceSign, isPinch, mapRange } from './gestureChecks';
import { makeHand } from '../test/hand';

describe('distance', () => {
  it('теорема Піфагора', () => expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5));
  it('нуль для однакових точок', () => expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0));
});

describe('mapRange', () => {
  it('лінійно переводить діапазони', () => expect(mapRange(5, 0, 10, 0, 100)).toBe(50));
  it('обмежує значення за краями вхідного діапазону', () => {
    expect(mapRange(-5, 0, 10, 0, 100)).toBe(0);
    expect(mapRange(50, 0, 10, 0, 100)).toBe(100);
  });
  it('підтримує обернений вихідний діапазон', () => expect(mapRange(2.5, 0, 10, 1, 0)).toBeCloseTo(0.75));
});

describe('розпізнавання жестів', () => {
  it('розкрита долоня', () => {
    const hand = makeHand(2.3);
    expect(isOpenPalm(hand)).toBe(true);
    expect(isFist(hand)).toBe(false);
  });
  it('кулак', () => {
    const hand = makeHand(0.9);
    expect(isFist(hand)).toBe(true);
    expect(isOpenPalm(hand)).toBe(false);
  });
  it('відкритість росте разом з відстанню пальців', () => {
    expect(getOpennessRatio(makeHand(2.3))).toBeGreaterThan(getOpennessRatio(makeHand(1.5)));
    expect(getOpennessRatio(makeHand(1.5))).toBeGreaterThan(getOpennessRatio(makeHand(0.9)));
  });
  it('не залежить від розміру руки в кадрі', () => {
    expect(getOpennessRatio(makeHand(2, { palm: 0.1 }))).toBeCloseTo(getOpennessRatio(makeHand(2, { palm: 0.25 })), 5);
  });
  it('щипок: великий і вказівний майже торкаються', () => {
    const hand = makeHand(1.5);
    hand[4] = { ...hand[8], x: hand[8].x + 0.01 };
    expect(isPinch(hand)).toBe(true);
    expect(isPinch(makeHand(2.3))).toBe(false);
  });
  it('знак «V»: вказівний і середній витягнуті, інші зігнуті', () => {
    const hand = makeHand(0.9);
    hand[8] = { x: 0.45, y: 0.7 - 0.2 * 2.2, z: 0 };
    hand[12] = { x: 0.5, y: 0.7 - 0.2 * 2.3, z: 0 };
    expect(isPeaceSign(hand)).toBe(true);
    expect(isPeaceSign(makeHand(2.3))).toBe(false);
  });
  it('нахил руки: рівна рука ≈ 0', () => {
    expect(Math.abs(getTilt(makeHand(2)))).toBeLessThan(0.2);
  });
});
