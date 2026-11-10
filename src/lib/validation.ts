// Перевірка полів форми реєстрації (та сама логіка діє на сервері)

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type Fields = { fullName: string; email: string; password: string };

export function validate({ fullName, email, password }: Fields): Partial<Record<keyof Fields, string>> {
  const errs: Partial<Record<keyof Fields, string>> = {};
  const name = fullName.trim();
  if (!name) errs.fullName = 'Вкажи своє ім’я';
  else if (name.length < 2) errs.fullName = 'Ім’я має містити щонайменше 2 символи';
  else if (name.length > 60) errs.fullName = 'Ім’я занадто довге (до 60 символів)';

  if (!email.trim()) errs.email = 'Вкажи email';
  else if (!EMAIL_RE.test(email.trim())) errs.email = 'Схоже, email введено з помилкою. Приклад: anna@gmail.com';

  if (!password) errs.password = 'Придумай пароль';
  else if (password.length < 8) errs.password = 'Пароль має містити щонайменше 8 символів';
  else if (new TextEncoder().encode(password).length > 72) errs.password = 'Пароль занадто довгий';
  else if (!/\p{L}/u.test(password) || !/\d/.test(password)) errs.password = 'Додай до пароля і літери, і цифри';
  return errs;
}

