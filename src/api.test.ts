import { describe, expect, it } from 'vitest';
import { getErrorMessage, uploadUrl, API_BASE_URL } from './api';

describe('getErrorMessage', () => {
  it('віддає текст помилки з сервера', () => {
    expect(getErrorMessage({ response: { status: 400, data: { error: 'Заповни всі поля' } } })).toBe('Заповни всі поля');
  });
  it('мережа недоступна', () => {
    expect(getErrorMessage({ message: 'Network Error' })).toMatch(/сервером|інтернет/i);
  });
  it('тайм-аут', () => {
    expect(getErrorMessage({ code: 'ECONNABORTED' })).toMatch(/довго/);
  });
  it('429 — забагато спроб', () => {
    expect(getErrorMessage({ response: { status: 429, data: {} } })).toMatch(/Забагато/);
  });
  it('413 — файл завеликий', () => {
    expect(getErrorMessage({ response: { status: 413, data: {} } })).toMatch(/завеликий/);
  });
  it('5xx — сервер недоступний', () => {
    expect(getErrorMessage({ response: { status: 503, data: {} } })).toMatch(/недоступний/);
  });
  it('невідома помилка — запасний текст', () => {
    expect(getErrorMessage({ response: { status: 418, data: {} } }, 'Запасний')).toBe('Запасний');
    expect(getErrorMessage(null, 'Запасний')).toMatch(/.+/);
  });
});

describe('uploadUrl', () => {
  it('звичайні файли йдуть через /uploads', () => {
    expect(uploadUrl('1-2.webm')).toBe(`${API_BASE_URL}/uploads/1-2.webm`);
  });
  it('звуки Freesound — через /freesound/preview', () => {
    expect(uploadUrl('fs:12345')).toBe(`${API_BASE_URL}/freesound/preview/12345`);
  });
});
