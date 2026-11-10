import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Looper, MAX_LAYERS } from './looper';
import { loadLooper, saveLooper } from './looperStore';

// Мінімальна імітація Web Audio: лише те, що потрібно лупера для збереження й експорту
class FakeBuffer {
  numberOfChannels: number;
  length: number;
  sampleRate: number;
  duration: number;
  private ch: Float32Array[];
  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.ch = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(i: number) {
    return this.ch[i];
  }
  copyToChannel(src: Float32Array, i: number) {
    this.ch[i].set(src);
  }
}
const node = () => ({ connect() {}, disconnect() {}, gain: { value: 1, setTargetAtTime() {} }, buffer: null as unknown, start() {}, stop() {}, loop: false, loopStart: 0, loopEnd: 0 });
const makeCtx = () =>
  ({
    sampleRate: 8000,
    currentTime: 0,
    baseLatency: 0,
    outputLatency: 0,
    createGain: node,
    createBufferSource: node,
    createBuffer: (c: number, l: number, sr: number) => new FakeBuffer(c, l, sr),
  }) as unknown as AudioContext;

function looperWith(layerValues: number[], seconds = 2) {
  const ctx = makeCtx();
  const lp = new Looper(ctx, node() as unknown as AudioNode, node() as unknown as AudioNode, () => {});
  const internal = lp as unknown as { duration: number; phase: string; addLayerFromBuffer: (b: AudioBuffer, n: string) => void };
  internal.duration = seconds;
  for (const v of layerValues) {
    const buf = ctx.createBuffer(2, 8000 * seconds, 8000);
    buf.getChannelData(0).fill(v);
    buf.getChannelData(1).fill(v);
    internal.addLayerFromBuffer(buf, 'шар ' + v);
  }
  internal.phase = 'playing';
  return lp;
}

const readWavInfo = async (blob: Blob) => {
  const buf = await new Promise<ArrayBuffer>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
  const dv = new DataView(buf);
  const tag = (o: number) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
  return { riff: tag(0), wave: tag(8), fmt: tag(12), data: tag(36), channels: dv.getUint16(22, true), rate: dv.getUint32(24, true), bits: dv.getUint16(34, true), size: buf.byteLength, dv };
};

describe('Looper: експорт у WAV', () => {
  it('порожній лупер не експортується', () => {
    const ctx = makeCtx();
    const lp = new Looper(ctx, node() as unknown as AudioNode, node() as unknown as AudioNode, () => {});
    expect(lp.exportWav()).toBeNull();
  });
  it('коректний заголовок WAV (стерео, 16 біт)', async () => {
    const res = looperWith([0.2])!.exportWav()!;
    const w = await readWavInfo(res.blob);
    expect([w.riff, w.wave, w.fmt, w.data]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(w.channels).toBe(2);
    expect(w.rate).toBe(8000);
    expect(w.bits).toBe(16);
    expect(res.blob.type).toBe('audio/wav');
  });
  it('коло повторюється, щоб запис був не коротшим за ~15 с, і не довшим за 40 с', () => {
    const res = looperWith([0.2], 2)!.exportWav()!;
    expect(res.duration).toBeGreaterThanOrEqual(14);
    expect(res.duration).toBeLessThanOrEqual(40);
    const long = looperWith([0.2], 30)!.exportWav()!;
    expect(long.duration).toBeLessThanOrEqual(40);
  });
  it('розмір файлу відповідає тривалості', async () => {
    const res = looperWith([0.2], 2)!.exportWav()!;
    const w = await readWavInfo(res.blob);
    expect(w.size).toBe(44 + res.duration * 8000 * 4);
  });
  it('шари сумуються, а гучність обмежується без перевантаження', async () => {
    const res = looperWith([0.5, 0.5, 0.5, 0.5])!.exportWav()!;
    const w = await readWavInfo(res.blob);
    expect(w.dv.getInt16(44, true)).toBe(32767);
  });
  it('вимкнений шар не потрапляє в запис', async () => {
    const lp = looperWith([0.5, 0.5]);
    lp.toggleMute(lp.layerList[0].id);
    lp.toggleMute(lp.layerList[1].id);
    expect(lp.exportWav()).toBeNull();
  });
});

describe('Looper: знімок і відновлення', () => {
  it('snapshot містить усі шари з назвами та PCM', () => {
    const snap = looperWith([0.1, 0.3])!.snapshot()!;
    expect(snap.layers).toHaveLength(2);
    expect(snap.duration).toBe(2);
    expect(snap.layers[1].name).toBe('шар 0.3');
    expect(snap.layers[1].left[0]).toBeCloseTo(0.3, 5);
  });
  it('restore повертає шари й стан «грає»', () => {
    const snap = looperWith([0.1, 0.3])!.snapshot()!;
    const ctx = makeCtx();
    const fresh = new Looper(ctx, node() as unknown as AudioNode, node() as unknown as AudioNode, () => {});
    fresh.restore(snap);
    expect(fresh.phase).toBe('playing');
    expect(fresh.layerList.map((l) => l.name)).toEqual(['шар 0.1', 'шар 0.3']);
    expect(fresh.duration).toBe(2);
  });
  it('збережений вимкнений шар лишається вимкненим', () => {
    const lp = looperWith([0.1, 0.3]);
    lp.toggleMute(lp.layerList[0].id);
    const fresh = new Looper(makeCtx(), node() as unknown as AudioNode, node() as unknown as AudioNode, () => {});
    fresh.restore(lp.snapshot()!);
    expect(fresh.layerList[0].muted).toBe(true);
    expect(fresh.layerList[1].muted).toBe(false);
  });
  it('restore не перезаписує лупер, у якому вже є шари', () => {
    const lp = looperWith([0.1]);
    lp.restore(looperWith([0.1, 0.2, 0.3])!.snapshot()!);
    expect(lp.layerList).toHaveLength(1);
  });
  it('шарів не більше MAX_LAYERS', () => {
    const lp = looperWith(Array(MAX_LAYERS + 3).fill(0.1));
    const fresh = new Looper(makeCtx(), node() as unknown as AudioNode, node() as unknown as AudioNode, () => {});
    fresh.restore(lp.snapshot()!);
    expect(fresh.layerList.length).toBeLessThanOrEqual(MAX_LAYERS);
  });
  it('порожній лупер не має знімка', () => {
    const lp = new Looper(makeCtx(), node() as unknown as AudioNode, node() as unknown as AudioNode, () => {});
    expect(lp.snapshot()).toBeNull();
  });
});

describe('looperStore (IndexedDB)', () => {
  beforeEach(async () => saveLooper(null));
  it('нічого не збережено — null', async () => {
    expect(await loadLooper()).toBeNull();
  });
  it('зберігає й читає назад', async () => {
    await saveLooper(looperWith([0.25])!.snapshot());
    const loaded = await loadLooper();
    expect(loaded?.layers).toHaveLength(1);
    expect(loaded?.layers[0].left[10]).toBeCloseTo(0.25, 5);
  });
  it('збереження null видаляє дані', async () => {
    await saveLooper(looperWith([0.25])!.snapshot());
    await saveLooper(null);
    expect(await loadLooper()).toBeNull();
  });
});
