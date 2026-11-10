import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { formatBytes, formatDuration, getStoredUser, initials, timeAgo } from './format';

describe('formatDuration', () => {
  it('форматує секунди як ММ:СС', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(59)).toBe('00:59');
    expect(formatDuration(60)).toBe('01:00');
    expect(formatDuration(754)).toBe('12:34');
  });
  it('округлює дробові значення', () => {
    expect(formatDuration(5.6)).toBe('00:06');
  });
  it('безпечно обробляє порожні та від’ємні значення', () => {
    expect(formatDuration(null)).toBe('00:00');
    expect(formatDuration(undefined)).toBe('00:00');
    expect(formatDuration(-10)).toBe('00:00');
  });
});

describe('formatBytes', () => {
  it('показує байти, кілобайти й мегабайти', () => {
    expect(formatBytes(0)).toBe('0 Б');
    expect(formatBytes(1023)).toBe('1023 Б');
    expect(formatBytes(2048)).toBe('2 КБ');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 МБ');
  });
  it('обробляє null', () => {
    expect(formatBytes(null)).toBe('0 Б');
  });
});

describe('initials', () => {
  it('бере першу літеру імені та прізвища', () => {
    expect(initials('Марія Пастух')).toBe('МП');
  });
  it('працює з одним словом і зайвими пробілами', () => {
    expect(initials('  anna  ')).toBe('A');
  });
  it('повертає «?» для порожнього імені', () => {
    expect(initials(undefined)).toBe('?');
    expect(initials('')).toBe('?');
  });
});

describe('timeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

  it('щойно / хвилини / години', () => {
    expect(timeAgo(ago(10_000))).toBe('щойно');
    expect(timeAgo(ago(5 * 60_000))).toBe('5 хв тому');
    expect(timeAgo(ago(3 * 3_600_000))).toBe('3 год тому');
  });
  it('вчора, дні, тижні, місяці, роки', () => {
    expect(timeAgo(ago(26 * 3_600_000))).toBe('вчора');
    expect(timeAgo(ago(3 * 86_400_000))).toBe('3 дн. тому');
    expect(timeAgo(ago(14 * 86_400_000))).toBe('2 тиж. тому');
    expect(timeAgo(ago(90 * 86_400_000))).toBe('3 міс. тому');
    expect(timeAgo(ago(800 * 86_400_000))).toBe('2 р. тому');
  });
});

describe('getStoredUser', () => {
  beforeEach(() => localStorage.clear());
  it('повертає користувача з localStorage', () => {
    localStorage.setItem('user', JSON.stringify({ id: 1, fullName: 'А Б', email: 'a@b.c' }));
    expect(getStoredUser()?.id).toBe(1);
  });
  it('повертає null, якщо запису немає або він зіпсований', () => {
    expect(getStoredUser()).toBeNull();
    localStorage.setItem('user', '{не json');
    expect(getStoredUser()).toBeNull();
  });
});
