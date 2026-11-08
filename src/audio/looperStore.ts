// Збереження лупера в IndexedDB, щоб шари не зникали після оновлення сторінки.

export type SavedLayer = { name: string; muted: boolean; left: Float32Array<ArrayBuffer>; right: Float32Array<ArrayBuffer> };
export type SavedLooper = { duration: number; sampleRate: number; layers: SavedLayer[] };

const DB = 'gesture-looper';
const STORE = 'state';
const KEY = 'current';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no idb'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function loadLooper(): Promise<SavedLooper | null> {
  try {
    const v = await run<SavedLooper | undefined>('readonly', (s) => s.get(KEY));
    return v && v.layers?.length ? v : null;
  } catch {
    return null;
  }
}

export async function saveLooper(state: SavedLooper | null): Promise<void> {
  try {
    if (state && state.layers.length) await run('readwrite', (s) => s.put(state, KEY));
    else await run('readwrite', (s) => s.delete(KEY));
  } catch {
    // сховище недоступне (приватний режим) — лупер просто не збережеться
  }
}
