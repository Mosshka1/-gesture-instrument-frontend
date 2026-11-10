import { describe, expect, it } from 'vitest';
import { computeAchievements } from './achievements';
import type { AchievementInput } from './achievements';
import { MODES } from '../audio/modes';

const base: AchievementInput = {
  stats: { playSeconds: 0, sessions: 0, modeSeconds: {}, maxLayers: 0, unlocked: [] },
  presets: 0,
  recordings: 0,
  shared: 0,
  sounds: 0,
  calibrated: false,
};
const get = (input: AchievementInput, id: string) => computeAchievements(input).find((a) => a.id === id)!;

describe('досягнення', () => {
  it('на початку нічого не здобуто', () => {
    expect(computeAchievements(base).every((a) => !a.done)).toBe(true);
  });
  it('id унікальні', () => {
    const ids = computeAchievements(base).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('«Перші ноти» з 5 секунд гри', () => {
    expect(get({ ...base, stats: { ...base.stats, playSeconds: 4 } }, 'first-notes').done).toBe(false);
    expect(get({ ...base, stats: { ...base.stats, playSeconds: 5 } }, 'first-notes').done).toBe(true);
  });
  it('«Розігрів» з 10 хвилин, прогрес показується', () => {
    const a = get({ ...base, stats: { ...base.stats, playSeconds: 11 * 60 } }, 'play-10');
    expect(a.done).toBe(true);
    const b = get({ ...base, stats: { ...base.stats, playSeconds: 4 * 60 } }, 'play-10');
    expect(b.done).toBe(false);
    expect(b.progress).toBe('4 / 10');
  });
  it('режими менше 5 секунд не рахуються', () => {
    const stats = { ...base.stats, modeSeconds: { ambient: 3, lead: 2, pluck: 1 } };
    expect(get({ ...base, stats }, 'modes-3').done).toBe(false);
  });
  it('3 режими здобувають «Розвідку звуку»', () => {
    const stats = { ...base.stats, modeSeconds: { ambient: 10, lead: 10, pluck: 10 } };
    expect(get({ ...base, stats }, 'modes-3').done).toBe(true);
  });
  it('невідомі режими не рахуються', () => {
    const stats = { ...base.stats, modeSeconds: { a: 99, b: 99, c: 99 } };
    expect(get({ ...base, stats }, 'modes-3').done).toBe(false);
  });
  it('усі режими', () => {
    const modeSeconds = Object.fromEntries(MODES.map((m) => [m.id, 10]));
    expect(get({ ...base, stats: { ...base.stats, modeSeconds } }, 'modes-all').done).toBe(true);
  });
  it('лупер: 3 шари', () => {
    expect(get({ ...base, stats: { ...base.stats, maxLayers: 3 } }, 'looper-3').done).toBe(true);
    expect(get({ ...base, stats: { ...base.stats, maxLayers: 2 } }, 'looper-3').progress).toBe('2 / 3');
  });
  it('прогрес не перевищує мету', () => {
    expect(get({ ...base, presets: 50 }, 'presets-5').progress).toBe('5 / 5');
  });
  it('пресети, записи, поділитися, звуки, калібрування', () => {
    const all = { ...base, presets: 5, recordings: 5, shared: 1, sounds: 1, calibrated: true };
    for (const id of ['first-preset', 'presets-5', 'first-rec', 'recs-5', 'shared', 'own-sound', 'calibrated']) {
      expect(get(all, id).done).toBe(true);
    }
  });
  it('локальні досягнення позначені, серверні ні', () => {
    expect(get(base, 'play-10').local).toBe(true);
    expect(get(base, 'first-rec').local).toBe(false);
  });
});
