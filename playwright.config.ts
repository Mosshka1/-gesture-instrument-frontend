import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 5173);

// Наскрізні тести: справжній браузер, сервер замінено імітацією (див. e2e/helpers.ts),
// тож для запуску не потрібні ні бекенд, ні база, ні камера.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'uk-UA',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
