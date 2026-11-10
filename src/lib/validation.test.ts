import { describe, expect, it } from 'vitest';
import { EMAIL_RE, validate } from './validation';

const ok = { fullName: 'Марія Пастух', email: 'maria@gmail.com', password: 'Qwerty123' };

describe('validate: коректні дані', () => {
  it('не повертає помилок', () => {
    expect(validate(ok)).toEqual({});
  });
  it('дозволяє кириличні літери в паролі', () => {
    expect(validate({ ...ok, password: 'Пароль2026' })).toEqual({});
  });
});

describe('validate: ім’я', () => {
  it('порожнє', () => expect(validate({ ...ok, fullName: '   ' }).fullName).toBeTruthy());
  it('замале (1 символ)', () => expect(validate({ ...ok, fullName: 'А' }).fullName).toMatch(/2 символи/));
  it('завелике (61 символ)', () => expect(validate({ ...ok, fullName: 'а'.repeat(61) }).fullName).toMatch(/довге/));
  it('рівно 60 символів — можна', () => expect(validate({ ...ok, fullName: 'а'.repeat(60) }).fullName).toBeUndefined());
});

describe('validate: email', () => {
  it('порожній', () => expect(validate({ ...ok, email: '' }).email).toBeTruthy());
  it.each(['abc', 'abc@', '@x.com', 'a@b', 'a b@x.com', 'a@@x.com', 'a@x.c'])('відхиляє «%s»', (email) => {
    expect(validate({ ...ok, email }).email).toBeTruthy();
  });
  it.each(['a@b.co', 'anna.k+test@mail.example.com', 'USER@GMAIL.COM'])('приймає «%s»', (email) => {
    expect(validate({ ...ok, email }).email).toBeUndefined();
  });
  it('обрізає пробіли навколо адреси', () => {
    expect(validate({ ...ok, email: '  maria@gmail.com ' }).email).toBeUndefined();
  });
  it('EMAIL_RE не приймає пробілів усередині', () => {
    expect(EMAIL_RE.test('a b@c.com')).toBe(false);
  });
});

describe('validate: пароль', () => {
  it('порожній', () => expect(validate({ ...ok, password: '' }).password).toBeTruthy());
  it('коротший за 8 символів', () => expect(validate({ ...ok, password: 'abc123' }).password).toMatch(/8 символів/));
  it('лише літери', () => expect(validate({ ...ok, password: 'abcdefghij' }).password).toMatch(/літери/));
  it('лише цифри', () => expect(validate({ ...ok, password: '1234567890' }).password).toMatch(/літери/));
  it('довший за 72 байти', () => expect(validate({ ...ok, password: 'a1'.repeat(40) }).password).toMatch(/довгий/));
  it('рахує байти, а не символи (кирилиця = 2 байти)', () => {
    expect(validate({ ...ok, password: 'ж1'.repeat(30) }).password).toMatch(/довгий/);
  });
  it('усі поля порожні — три помилки', () => {
    expect(Object.keys(validate({ fullName: '', email: '', password: '' }))).toHaveLength(3);
  });
});
