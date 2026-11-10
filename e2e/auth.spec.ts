import { expect, test } from '@playwright/test';
import { makeState, mockApi } from './helpers';

test.describe('Реєстрація', () => {
  test.beforeEach(async ({ page }) => mockApi(page));

  test('порожня форма показує три помилки й не надсилає запит', async ({ page }) => {
    const state = makeState();
    await mockApi(page, state);
    await page.goto('/register');
    await page.getByRole('button', { name: 'Створити акаунт', exact: true }).click();
    await expect(page.locator('.field-error')).toHaveCount(3);
    expect(state.calls.filter((c) => c.includes('/auth/register'))).toHaveLength(0);
  });

  test('помилка біля email з’являється після виходу з поля', async ({ page }) => {
    await page.goto('/register');
    await page.getByPlaceholder('anna@studio.dev').fill('abc@x');
    await page.getByPlaceholder('Анна Коваленко').click();
    await expect(page.getByText('email введено з помилкою')).toBeVisible();
  });

  test('слабкий пароль: лише літери', async ({ page }) => {
    await page.goto('/register');
    await page.getByPlaceholder('Придумай пароль').fill('abcdefghij');
    await page.getByPlaceholder('anna@studio.dev').click();
    await expect(page.getByText('Додай до пароля і літери, і цифри')).toBeVisible();
  });

  test('підказка про пароль видно, поки помилки немає', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Щонайменше 8 символів, літери й цифри')).toBeVisible();
  });

  test('успішна реєстрація веде на навчання й зберігає токен', async ({ page }) => {
    await page.goto('/register');
    await page.getByPlaceholder('Анна Коваленко').fill('Анна Коваленко');
    await page.getByPlaceholder('anna@studio.dev').fill('Anna@Example.com');
    await page.getByPlaceholder('Придумай пароль').fill('Qwerty123');
    await page.getByRole('button', { name: 'Створити акаунт', exact: true }).click();
    await expect(page).toHaveURL(/\/tutorial/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBe('tok');
  });

  test('email відправляється в нижньому регістрі', async ({ page }) => {
    let sent: any = null;
    page.on('request', (r) => {
      if (r.url().endsWith('/auth/register')) sent = r.postDataJSON();
    });
    await page.goto('/register');
    await page.getByPlaceholder('Анна Коваленко').fill('Анна');
    await page.getByPlaceholder('anna@studio.dev').fill('  Anna@Example.COM ');
    await page.getByPlaceholder('Придумай пароль').fill('Qwerty123');
    await page.getByRole('button', { name: 'Створити акаунт', exact: true }).click();
    await expect(page).toHaveURL(/\/tutorial/);
    expect(sent.email).toBe('anna@example.com');
  });

  test('помилка сервера (email зайнятий) показується в формі', async ({ page }) => {
    await page.goto('/register');
    await page.getByPlaceholder('Анна Коваленко').fill('Анна');
    await page.getByPlaceholder('anna@studio.dev').fill('taken@example.com');
    await page.getByPlaceholder('Придумай пароль').fill('Qwerty123');
    await page.getByRole('button', { name: 'Створити акаунт', exact: true }).click();
    await expect(page.locator('.error-box')).toContainText('вже існує');
  });

  test('є посилання на умови та політику', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('link', { name: 'умовами' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'політикою конфіденційності' })).toBeVisible();
  });
});

test.describe('Вхід', () => {
  test('правильний пароль веде на навчання', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.getByPlaceholder('anna@studio.dev').fill('maria@example.com');
    await page.getByPlaceholder('••••••••').fill('Correct123');
    await page.getByRole('button', { name: 'Увійти', exact: true }).click();
    await expect(page).toHaveURL(/\/tutorial/);
  });

  test('після пройденого навчання вхід веде в гру', async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => localStorage.setItem('tutorialCompleted', '1'));
    await page.goto('/login');
    await page.getByPlaceholder('anna@studio.dev').fill('maria@example.com');
    await page.getByPlaceholder('••••••••').fill('Correct123');
    await page.getByRole('button', { name: 'Увійти', exact: true }).click();
    await expect(page).toHaveURL(/\/play/);
  });

  test('неправильний пароль показує помилку й лишає на сторінці', async ({ page }) => {
    await mockApi(page);
    await page.goto('/login');
    await page.getByPlaceholder('anna@studio.dev').fill('maria@example.com');
    await page.getByPlaceholder('••••••••').fill('wrong');
    await page.getByRole('button', { name: 'Увійти', exact: true }).click();
    await expect(page.locator('.error-box')).toContainText('Невірний email або пароль');
    await expect(page).toHaveURL(/\/login/);
  });

  test('забагато спроб (429) показує зрозуміле повідомлення', async ({ page }) => {
    await mockApi(page, makeState(), { failLogin: 429 });
    await page.goto('/login');
    await page.getByPlaceholder('anna@studio.dev').fill('maria@example.com');
    await page.getByPlaceholder('••••••••').fill('Correct123');
    await page.getByRole('button', { name: 'Увійти', exact: true }).click();
    await expect(page.locator('.error-box')).toContainText('Забагато спроб');
  });

  test('гість без токена не потрапляє на захищені сторінки', async ({ page }) => {
    await mockApi(page);
    for (const path of ['/play', '/presets', '/recordings', '/sounds', '/profile']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test('прострочений токен: повернення на вхід із поясненням', async ({ page }) => {
    // токен підставляємо лише при першому завантаженні, щоб після виходу він не з’явився знову
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('token', 'old');
      localStorage.setItem('user', JSON.stringify({ id: 1, fullName: 'А Б', email: 'a@b.cc' }));
    });
    await page.route('http://localhost:3000/**', (r) =>
      r.fulfill({ status: 401, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ error: 'Недійсний токен' }) }),
    );
    await page.goto('/recordings');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.error-box')).toContainText('Сесія завершилась');
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  });
});
