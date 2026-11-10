import { beforeEach, describe, expect, it } from 'vitest';
import { clearStats, formatPlayTime, loadStats, saveStats } from './stats';

beforeEach(() => localStorage.clear());

describe('stats: збереження', () => {
  it('порожня статистика за замовчуванням', () => {
    expect(loadStats()).toEqual({ playSeconds: 0, sessions: 0, modeSeconds: {}, maxLayers: 0, unlocked: [] });
  });
  it('зберігає й читає назад', () => {
    const s = { playSeconds: 120, sessions: 3, modeSeconds: { ambient: 100 }, maxLayers: 2, unlocked: ['first-notes'] };
    saveStats(s);
    expect(loadStats()).toEqual(s);
  });
  it('статистика різних користувачів окрема', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, fullName: 'A', email: 'a@a.aa' }));
    saveStats({ playSeconds: 50, sessions: 1, modeSeconds: {}, maxLayers: 0, unlocked: [] });
    localStorage.setItem('user', JSON.stringify({ id: 2, fullName: 'B', email: 'b@b.bb' }));
    expect(loadStats().playSeconds).toBe(0);
  });
  it('зіпсований запис не ламає застосунок', () => {
    localStorage.setItem('gs:stats:guest', 'не json');
    expect(loadStats().playSeconds).toBe(0);
  });
  it('clearStats стирає дані', () => {
    saveStats({ playSeconds: 9, sessions: 1, modeSeconds: {}, maxLayers: 0, unlocked: [] });
    clearStats();
    expect(loadStats().playSeconds).toBe(0);
  });
});

describe('formatPlayTime', () => {
  it('секунди', () => expect(formatPlayTime(30)).toBe('30 с'));
  it('хвилини', () => expect(formatPlayTime(11 * 60 + 5)).toBe('11 хв'));
  it('години й хвилини', () => expect(formatPlayTime(3600 + 25 * 60)).toBe('1 год 25 хв'));
});
