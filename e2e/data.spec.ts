import { expect, test } from '@playwright/test';
import { loginAs, makeState, mockApi } from './helpers';
import type { State } from './helpers';

let state: State;
test.beforeEach(async ({ page, context }) => {
  state = makeState();
  await mockApi(page, state);
  await loginAs(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
});

test.describe('Записи', () => {
  test('список показує записи', async ({ page }) => {
    await page.goto('/recordings');
    await expect(page.locator('.rec-item')).toHaveCount(2);
    await expect(page.getByText('Хор у лісі')).toBeVisible();
  });

  test('перейменування: тост і нова назва', async ({ page }) => {
    await page.goto('/recordings');
    await page.locator('.rec-item').first().getByTitle('Перейменувати').click();
    await page.locator('.modal input').fill('Нова назва');
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await expect(page.locator('.toast.success')).toContainText('перейменовано');
    await expect(page.getByText('Нова назва')).toBeVisible();
  });

  test('видалення вимагає підтвердження; «Скасувати» нічого не видаляє', async ({ page }) => {
    await page.goto('/recordings');
    await page.locator('.rec-item').first().getByTitle('Видалити').click();
    await expect(page.getByRole('dialog')).toContainText('Видалити запис?');
    await page.getByRole('button', { name: 'Скасувати' }).click();
    await expect(page.locator('.rec-item')).toHaveCount(2);
  });

  test('видалення: тост і запис зникає', async ({ page }) => {
    await page.goto('/recordings');
    await page.locator('.rec-item').first().getByTitle('Видалити').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Видалити' }).click();
    await expect(page.locator('.toast.success')).toContainText('видалено');
    await expect(page.locator('.rec-item')).toHaveCount(1);
  });

  test('Esc закриває модальне вікно', async ({ page }) => {
    await page.goto('/recordings');
    await page.locator('.rec-item').first().getByTitle('Видалити').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('фокус не виходить за межі модального вікна', async ({ page }) => {
    await page.goto('/recordings');
    await page.locator('.rec-item').first().getByTitle('Видалити').click();
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.modal'))).toBe(true);
  });

  test('після закриття вікна фокус повертається на кнопку', async ({ page }) => {
    await page.goto('/recordings');
    const btn = page.locator('.rec-item').first().getByTitle('Видалити');
    await btn.click();
    await page.keyboard.press('Escape');
    await expect(btn).toBeFocused();
  });

  test('поділитися: з’являється посилання /s/…', async ({ page }) => {
    await page.goto('/recordings');
    await page.locator('.rec-item').first().getByRole('button', { name: 'Поділитися' }).click();
    const input = page.locator('.modal input');
    await expect(input).toHaveValue(/\/s\/tok1abcdef$/);
  });

  test('копіювання посилання показує тост і кладе його в буфер', async ({ page }) => {
    await page.goto('/recordings');
    await page.locator('.rec-item').first().getByRole('button', { name: 'Поділитися' }).click();
    await page.getByRole('button', { name: 'Копіювати посилання' }).click();
    await expect(page.locator('.toast.success')).toContainText('скопійовано');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/\/s\/tok1abcdef$/);
  });

  test('закрити доступ: тост, токен знято', async ({ page }) => {
    await page.goto('/recordings');
    await page.locator('.rec-item').first().getByRole('button', { name: 'Поділитися' }).click();
    await page.getByRole('button', { name: 'Закрити доступ' }).click();
    await expect(page.locator('.toast.success')).toContainText('Доступ');
    expect(state.recordings[0].shareToken).toBeNull();
  });

  test('повторне відкриття віддає те саме посилання', async ({ page }) => {
    await page.goto('/recordings');
    const btn = page.locator('.rec-item').first().getByRole('button', { name: 'Поділитися' });
    await btn.click();
    const first = await page.locator('.modal input').inputValue();
    await page.keyboard.press('Escape');
    await btn.click();
    expect(await page.locator('.modal input').inputValue()).toBe(first);
  });
});

test.describe('Пресети', () => {
  test('список і створення нового', async ({ page }) => {
    await page.goto('/presets');
    await expect(page.locator('.preset-name', { hasText: 'Пад' })).toBeVisible();
    await page.getByRole('button', { name: '+ Новий пресет' }).first().click();
    await page.locator('.modal input.input').first().fill('Мій пресет');
    await page.getByRole('dialog').getByRole('button', { name: /Зберегти|Створити/ }).click();
    await expect(page.locator('.toast.success')).toContainText('створено');
    await expect(page.locator('.preset-name', { hasText: 'Мій пресет' })).toBeVisible();
  });

  test('порожня назва не дозволяє створити пресет', async ({ page }) => {
    await page.goto('/presets');
    await page.getByRole('button', { name: '+ Новий пресет' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /Зберегти|Створити/ }).click();
    await expect(page.getByText('Дай пресету назву')).toBeVisible();
  });

  test('видалення пресета', async ({ page }) => {
    await page.goto('/presets');
    await page.getByRole('button', { name: /Видалити/ }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Видалити' }).click();
    await expect(page.locator('.toast.success')).toContainText('видалено');
  });
});

test.describe('Власні звуки', () => {
  test('не аудіофайл відхиляється', async ({ page }) => {
    await page.goto('/sounds');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(page.locator('.error-box').first()).toContainText('лише аудіофайли');
  });

  test('завелике аудіо відхиляється', async ({ page }) => {
    await page.goto('/sounds');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'big.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(11 * 1024 * 1024) });
    await expect(page.locator('.error-box').first()).toContainText('завеликий');
  });

  test('завантаження аудіо: тост успіху', async ({ page }) => {
    await page.goto('/sounds');
    await page.locator('input[type=file]').first().setInputFiles({ name: 'a.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(2048) });
    await page.getByRole('button', { name: 'Завантажити' }).first().click();
    await expect(page.locator('.toast.success')).toContainText('Звук додано');
  });

  test('без вибраного файла — підказка', async ({ page }) => {
    await page.goto('/sounds');
    await page.getByRole('button', { name: 'Завантажити' }).first().click();
    await expect(page.locator('.error-box').first()).toContainText('Обери аудіофайл');
  });
});

test.describe('Профіль, статистика й видалення акаунта', () => {
  test('статистика з браузера та прогрес досягнень', async ({ page }) => {
    await loginAs(page, { 'gs:stats:1': JSON.stringify({ playSeconds: 700, sessions: 4, modeSeconds: { ambient: 400, lead: 200, pluck: 100 }, maxLayers: 2, unlocked: [] }) });
    await page.goto('/profile');
    const stats = page.locator('#stats');
    await expect(stats).toContainText('11 хв');
    await expect(stats).toContainText('Ембіентний пад');
    await expect(stats).toContainText('3 / 9');
    await expect(stats.locator('.ach.done')).not.toHaveCount(0);
  });

  test('здобуті за записи досягнення рахуються із сервера', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('.ach.done', { hasText: 'Перший запис' })).toBeVisible();
    await expect(page.locator('.ach.done', { hasText: 'Свій стиль' })).toBeVisible();
  });

  test('зміна імені: надто коротке відхиляється', async ({ page }) => {
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Редагувати профіль' }).click();
    await page.locator('#account input').first().fill('А');
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await expect(page.locator('#account .error-box')).toContainText('від 2 до 60');
  });

  test('зміна імені: тост успіху', async ({ page }) => {
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Редагувати профіль' }).click();
    await page.locator('#account input').first().fill('Марія Нова');
    await page.getByRole('button', { name: 'Зберегти' }).click();
    await expect(page.locator('.toast.success')).toContainText('Ім’я оновлено');
  });

  test('видалення акаунта: кнопка активна лише після слова ВИДАЛИТИ', async ({ page }) => {
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Видалити акаунт' }).click();
    const confirm = page.getByRole('button', { name: 'Видалити назавжди' });
    await expect(confirm).toBeDisabled();
    await page.locator('.modal input').fill('видалити');
    await expect(confirm).toBeEnabled();
  });

  test('видалення акаунта: запит, очищення даних і перехід на вхід', async ({ page }) => {
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Видалити акаунт' }).click();
    await page.locator('.modal input').fill('ВИДАЛИТИ');
    await page.getByRole('button', { name: 'Видалити назавжди' }).click();
    await expect(page).toHaveURL(/\/login/);
    expect(state.deleted).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });
});
