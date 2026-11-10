import { expect, test } from '@playwright/test';
import { loginAs, makeState, mockApi } from './helpers';

test.describe('Публічні сторінки', () => {
  test.beforeEach(async ({ page }) => mockApi(page));

  test('політика конфіденційності', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Політика конфіденційності' })).toBeVisible();
    await expect(page.getByText('Зображення з камери обробляється лише в твоєму браузері')).toBeVisible();
  });

  test('умови користування', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Умови користування' })).toBeVisible();
  });

  test('зі сторінки входу можна дійти до політики й умов', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Конфіденційність' }).click();
    await expect(page).toHaveURL(/\/privacy/);
    await page.getByRole('link', { name: 'Умови користування' }).last().click();
    await expect(page).toHaveURL(/\/terms/);
  });

  test('сторінка запису за посиланням', async ({ page }) => {
    await page.goto('/s/valid-token-1');
    await expect(page.getByRole('heading', { name: 'Хор у лісі' })).toBeVisible();
    await expect(page.getByText('Автор: Марія')).toBeVisible();
    await expect(page.locator('audio')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Спробувати самому' })).toBeVisible();
  });

  test('недійсне посилання на запис', async ({ page }) => {
    await page.goto('/s/zzzzzzzzzz');
    await expect(page.getByRole('heading', { name: 'Посилання більше не діє' })).toBeVisible();
  });
});

test.describe('Навігація та оформлення', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
    await loginAs(page);
  });

  const pages: Array<[string, string]> = [
    ['/modes', 'Вибери режим інструмента'],
    ['/presets', 'Мої пресети'],
    ['/recordings', 'Мої записи'],
    ['/sounds', 'Власні звуки'],
    ['/tutorial', 'Як грати'],
    ['/profile', 'Особистий кабінет'],
  ];
  for (const [path, title] of pages) {
    test(`сторінка ${path} відкривається`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    });
  }

  test('меню веде по розділах', async ({ page }) => {
    await page.goto('/modes');
    await page.locator('.nav-strip').getByRole('link', { name: 'Записи' }).click();
    await expect(page).toHaveURL(/\/recordings/);
    await page.locator('.nav-strip').getByRole('link', { name: 'Пресети' }).click();
    await expect(page).toHaveURL(/\/presets/);
  });

  test('невідома адреса веде в гру', async ({ page }) => {
    await page.goto('/щось-неіснуюче');
    await expect(page).toHaveURL(/\/play/);
  });

  test('темна тема перемикається й запам’ятовується', async ({ page }) => {
    await page.goto('/modes');
    await page.locator('.masthead-end').getByRole('button').first().click();
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(['dark', 'light']).toContain(theme);
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe(theme);
  });

  test('перехід між сторінками прокручує вгору', async ({ page }) => {
    await page.goto('/modes');
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.locator('.nav-strip').getByRole('link', { name: 'Звуки' }).click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test('немає інтернету: смужка з попередженням, потім тост «зв’язок відновлено»', async ({ page }) => {
    await page.goto('/modes');
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('.offline-bar')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('.offline-bar')).toHaveCount(0);
    await expect(page.locator('.toast.success')).toContainText('Зв’язок відновлено');
  });

  test('ігрова сторінка без трекінгу пояснює проблему', async ({ page }) => {
    await page.goto('/play');
    await expect(page.getByRole('heading', { name: 'Не завантажився трекінг руки' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Оновити сторінку' })).toBeVisible();
  });
});

test.describe('Адаптивність (телефон 390 px)', () => {
  test.use({ viewport: { width: 390, height: 800 } });
  for (const path of ['/login', '/register', '/privacy', '/modes', '/presets', '/recordings', '/sounds', '/profile']) {
    test(`${path}: немає горизонтальної прокрутки`, async ({ page }) => {
      await mockApi(page);
      if (!['/login', '/register', '/privacy'].includes(path)) await loginAs(page);
      await page.goto(path);
      await page.waitForTimeout(600);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
      expect(overflow).toBe(false);
    });
  }
});

test('вихід з акаунта стирає токен і лупер', async ({ page }) => {
  await mockApi(page, makeState());
  await loginAs(page, { activePreset: '{}' });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Вийти' }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('activePreset'))).toBeNull();
});
