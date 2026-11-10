import type { Page, Route } from '@playwright/test';

export const API = 'http://localhost:3000';
export const USER = { id: 1, fullName: 'Марія Пастух', email: 'maria@example.com' };
const now = new Date().toISOString();

export type Rec = { id: number; name: string; fileName: string; mode: string | null; durationSec: number | null; sizeBytes: number | null; shareToken: string | null; createdAt: string };

export function makeState() {
  return {
    recordings: [
      { id: 1, name: 'Хор у лісі', fileName: 'a.webm', mode: 'choir', durationSec: 26, sizeBytes: 354000, shareToken: null, createdAt: now },
      { id: 2, name: 'Нічний пад', fileName: 'b.webm', mode: 'ambient', durationSec: 40, sizeBytes: 512000, shareToken: null, createdAt: now },
    ] as Rec[],
    presets: [
      { id: 1, name: 'Пад', soundType: 'ambient', settings: { reverb: 60, echo: 35, tone: 70, wave: 'triangle', scale: 'minor', root: 9 }, favorite: false, usedCount: 4, createdAt: now, updatedAt: now },
    ] as any[],
    sounds: [] as any[],
    deleted: false,
    calls: [] as string[],
  };
}
export type State = ReturnType<typeof makeState>;

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });

/** Імітація API з простим станом у пам’яті. */
export async function mockApi(page: Page, state: State = makeState(), opts: { failLogin?: number } = {}) {
  await page.route(`${API}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    state.calls.push(`${method} ${path}`);
    if (method === 'OPTIONS') return json(route, {});

    if (path === '/auth/me' && method === 'GET') return json(route, { user: { ...USER, createdAt: now } });
    if (path === '/auth/me' && method === 'PUT') {
      const body = req.postDataJSON();
      return json(route, { user: { ...USER, fullName: body.fullName, createdAt: now } });
    }
    if (path === '/auth/me' && method === 'DELETE') {
      state.deleted = true;
      return json(route, { ok: true });
    }
    if (path === '/auth/register') {
      const b = req.postDataJSON();
      if (b.email === 'taken@example.com') return json(route, { error: 'Користувач з таким email вже існує' }, 400);
      return json(route, { token: 'tok', user: { id: 2, fullName: b.fullName, email: b.email } });
    }
    if (path === '/auth/login') {
      const b = req.postDataJSON();
      if (opts.failLogin === 429) return json(route, { error: 'Забагато спроб. Зачекай кілька хвилин і спробуй ще раз' }, 429);
      if (b.password !== 'Correct123') return json(route, { error: 'Невірний email або пароль' }, 401);
      return json(route, { token: 'tok', user: USER });
    }
    if (path === '/settings') return json(route, { calibration: null });
    if (path === '/presets' && method === 'GET') return json(route, { presets: state.presets });
    if (path === '/presets' && method === 'POST') {
      const b = req.postDataJSON();
      const p = { id: 100 + state.presets.length, name: b.name, soundType: b.soundType, settings: b.settings || {}, favorite: false, usedCount: 0, createdAt: now, updatedAt: now };
      state.presets.unshift(p);
      return json(route, { preset: p });
    }
    const presetId = path.match(/^\/presets\/(\d+)$/);
    if (presetId && method === 'DELETE') {
      state.presets = state.presets.filter((p) => p.id !== Number(presetId[1]));
      return json(route, { ok: true });
    }
    if (path === '/recordings' && method === 'GET') return json(route, { recordings: state.recordings });
    const recId = path.match(/^\/recordings\/(\d+)$/);
    if (recId && method === 'PUT') {
      const r = state.recordings.find((x) => x.id === Number(recId[1]))!;
      r.name = req.postDataJSON().name;
      return json(route, { recording: r });
    }
    if (recId && method === 'DELETE') {
      state.recordings = state.recordings.filter((x) => x.id !== Number(recId[1]));
      return json(route, { ok: true });
    }
    const share = path.match(/^\/recordings\/(\d+)\/share$/);
    if (share && method === 'POST') {
      const r = state.recordings.find((x) => x.id === Number(share[1]))!;
      r.shareToken = r.shareToken || 'tok' + r.id + 'abcdef';
      return json(route, { shareToken: r.shareToken });
    }
    if (share && method === 'DELETE') {
      state.recordings.find((x) => x.id === Number(share[1]))!.shareToken = null;
      return json(route, { ok: true });
    }
    if (path === '/sounds' && method === 'GET') return json(route, { sounds: state.sounds });
    if (path === '/sounds' && method === 'POST') {
      const s = { id: 200 + state.sounds.length, name: 'Мій звук', fileName: 'x.wav', type: 'instrument', author: null, license: null, sourceUrl: null, createdAt: now };
      state.sounds.push(s);
      return json(route, { sound: s });
    }
    const shared = path.match(/^\/share\/(.+)$/);
    if (shared) {
      if (shared[1] === 'valid-token-1') return json(route, { recording: { name: 'Хор у лісі', mode: 'choir', durationSec: 26, fileName: 'a.webm', createdAt: now, author: 'Марія' } });
      return json(route, { error: 'Посилання не діє' }, 404);
    }
    if (path.startsWith('/uploads/')) return route.fulfill({ status: 404 });
    return json(route, { error: 'not mocked: ' + path }, 404);
  });
  // без інтернету всередині тестів: бібліотеки MediaPipe не вантажимо
  await page.route(/cdn\.jsdelivr\.net|accounts\.google\.com\/gsi|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
}

export async function loginAs(page: Page, extra: Record<string, string> = {}) {
  await page.addInitScript(
    ([user, extraItems]) => {
      localStorage.setItem('token', 'tok');
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('tutorialCompleted', '1');
      for (const [k, v] of Object.entries(extraItems as Record<string, string>)) localStorage.setItem(k, v);
    },
    [USER, extra] as const,
  );
}
