// Лупер: записує «шари» гри по колу. Перший шар задає довжину петлі,
// кожен наступний записується рівно на одне коло поверх тих, що вже грають.

export type LooperPhase = 'idle' | 'countin' | 'recBase' | 'playing' | 'armed' | 'recLayer';

export type LayerInfo = { id: number; name: string; muted: boolean };

type Layer = LayerInfo & { buffer: AudioBuffer; gain: GainNode; src: AudioBufferSourceNode | null };

const COUNT_IN_BEATS = 3;
const BEAT = 0.7; // секунд між «клацаннями» відліку
export const MAX_LAYERS = 6;
const MAX_BASE_SECONDS = 30;

export class Looper {
  phase: LooperPhase = 'idle';
  duration = 0; // довжина петлі, с
  countdown = 0; // 3,2,1 під час відліку
  private layers: Layer[] = [];
  private origin = 0; // момент ctx.currentTime, коли «коло» почалось (для синхронізації)
  private nextId = 1;
  private bus: GainNode;
  private timers: number[] = [];

  // стан запису
  private proc: ScriptProcessorNode | null = null;
  private sink: GainNode | null = null;
  private chunks: Float32Array[][] = [[], []];
  private captured = 0;
  private captureStart = 0; // ctx-час, з якого беремо звук
  private targetSamples = 0; // 0 = до ручної зупинки
  private pendingName = '';

  private ctx: AudioContext;
  private input: AudioNode; // звідки беремо звук інструмента (без петель)
  private onChange: () => void;

  constructor(ctx: AudioContext, input: AudioNode, output: AudioNode, onChange: () => void) {
    this.ctx = ctx;
    this.input = input;
    this.onChange = onChange;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.9;
    this.bus.connect(output);
  }

  get layerList(): LayerInfo[] {
    return this.layers.map(({ id, name, muted }) => ({ id, name, muted }));
  }

  // позиція в колі 0..1
  get position(): number {
    if (!this.duration || (this.phase !== 'playing' && this.phase !== 'armed' && this.phase !== 'recLayer')) return 0;
    const t = (this.ctx.currentTime - this.origin) % this.duration;
    return (t < 0 ? t + this.duration : t) / this.duration;
  }

  private emit() {
    this.onChange();
  }

  private latency() {
    return this.ctx.outputLatency || this.ctx.baseLatency || 0;
  }

  private click(at: number, high: boolean) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = high ? 1500 : 1000;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.25, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    osc.connect(g);
    g.connect(this.ctx.destination); // клацання не потрапляє ні в шари, ні в запис
    osc.start(at);
    osc.stop(at + 0.1);
  }

  // ---------- запис звуку (PCM) ----------
  private beginCapture(startAt: number, targetSamples: number) {
    const ctx = this.ctx;
    this.chunks = [[], []];
    this.captured = 0;
    this.captureStart = startAt;
    this.targetSamples = targetSamples;
    const proc = ctx.createScriptProcessor(1024, 2, 2);
    const sink = ctx.createGain();
    sink.gain.value = 0; // ScriptProcessor має бути підключений до виходу, але ми нічого не чути
    proc.onaudioprocess = (e) => this.onBlock(e);
    this.input.connect(proc);
    proc.connect(sink);
    sink.connect(ctx.destination);
    this.proc = proc;
    this.sink = sink;
  }

  private onBlock(e: AudioProcessingEvent) {
    const sr = this.ctx.sampleRate;
    const n = e.inputBuffer.length;
    const blockStart = this.ctx.currentTime;
    let from = 0;
    if (blockStart < this.captureStart) {
      from = Math.round((this.captureStart - blockStart) * sr);
      if (from >= n) return; // ще не час
    }
    let take = n - from;
    if (this.targetSamples) take = Math.min(take, this.targetSamples - this.captured);
    if (take <= 0) return;
    for (let ch = 0; ch < 2; ch++) {
      const src = e.inputBuffer.getChannelData(Math.min(ch, e.inputBuffer.numberOfChannels - 1));
      this.chunks[ch].push(src.slice(from, from + take));
    }
    this.captured += take;

    if (this.targetSamples && this.captured >= this.targetSamples) {
      queueMicrotask(() => this.finishCapture());
    } else if (!this.targetSamples && this.captured / sr >= MAX_BASE_SECONDS) {
      queueMicrotask(() => this.stopBase());
    }
  }

  private endCapture(): AudioBuffer | null {
    const proc = this.proc;
    if (!proc) return null;
    proc.onaudioprocess = null;
    try {
      this.input.disconnect(proc);
      proc.disconnect();
      this.sink?.disconnect();
    } catch {
      // вже відключено
    }
    this.proc = null;
    this.sink = null;
    if (this.captured < 1) return null;

    const buf = this.ctx.createBuffer(2, this.captured, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const out = buf.getChannelData(ch);
      let off = 0;
      for (const c of this.chunks[ch]) {
        out.set(c, off);
        off += c.length;
      }
    }
    this.chunks = [[], []];
    return buf;
  }

  // ---------- керування ----------
  /** Відлік 3-2-1, далі запис основи (біт чи перша мелодія). */
  startBase(name: string) {
    if (this.phase !== 'idle') return;
    this.pendingName = name;
    const t0 = this.ctx.currentTime + 0.15;
    for (let i = 0; i < COUNT_IN_BEATS; i++) this.click(t0 + i * BEAT, false);
    const go = t0 + COUNT_IN_BEATS * BEAT;
    this.click(go, true);
    this.phase = 'countin';
    this.countdown = COUNT_IN_BEATS;
    for (let i = 1; i < COUNT_IN_BEATS; i++) {
      this.timers.push(window.setTimeout(() => { this.countdown = COUNT_IN_BEATS - i; this.emit(); }, i * BEAT * 1000 + 150));
    }
    this.beginCapture(go + this.latency(), 0);
    this.timers.push(
      window.setTimeout(() => {
        if (this.phase === 'countin') {
          this.phase = 'recBase';
          this.countdown = 0;
          this.emit();
        }
      }, (go - this.ctx.currentTime) * 1000),
    );
    this.emit();
  }

  stopBase() {
    if (this.phase !== 'recBase' && this.phase !== 'countin') return;
    const wasCounting = this.phase === 'countin';
    this.timers.forEach(clearTimeout);
    this.timers = [];
    const buf = this.endCapture();
    if (wasCounting || !buf || buf.duration < 0.5) {
      this.phase = 'idle';
      this.countdown = 0;
      this.emit();
      return;
    }
    this.duration = buf.duration;
    this.origin = this.ctx.currentTime;
    this.addLayerFromBuffer(buf, this.pendingName);
    this.phase = 'playing';
    this.emit();
  }

  /** Записати ще один шар: чекаємо початок наступного кола і пишемо рівно одне коло. */
  addLayer(name: string) {
    if (this.phase !== 'playing' || this.layers.length >= MAX_LAYERS) return;
    const now = this.ctx.currentTime;
    const lat = this.latency();
    const sinceOrigin = (now - this.origin) % this.duration;
    let wait = this.duration - sinceOrigin;
    if (wait < 0.25) wait += this.duration; // щоб встигнути підготуватись
    const boundary = now + wait;
    this.pendingName = name;
    this.phase = 'armed';
    this.beginCapture(boundary + lat, Math.round(this.duration * this.ctx.sampleRate));
    this.timers.push(
      window.setTimeout(() => {
        if (this.phase === 'armed') {
          this.phase = 'recLayer';
          this.emit();
        }
      }, wait * 1000),
    );
    this.emit();
  }

  private finishCapture() {
    if (this.phase !== 'armed' && this.phase !== 'recLayer') return;
    const buf = this.endCapture();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.phase = 'playing';
    if (buf) this.addLayerFromBuffer(buf, this.pendingName);
    this.emit();
  }

  cancelLayer() {
    if (this.phase !== 'armed' && this.phase !== 'recLayer') return;
    this.endCapture();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.phase = 'playing';
    this.emit();
  }

  private startSource(layer: Layer) {
    const src = this.ctx.createBufferSource();
    src.buffer = layer.buffer;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = layer.buffer.duration;
    src.connect(layer.gain);
    const now = this.ctx.currentTime;
    const phase = (((now - this.origin) % this.duration) + this.duration) % this.duration;
    src.start(now, phase);
    layer.src = src;
  }

  private addLayerFromBuffer(buffer: AudioBuffer, name: string) {
    const gain = this.ctx.createGain();
    gain.connect(this.bus);
    const layer: Layer = { id: this.nextId++, name, muted: false, buffer, gain, src: null };
    this.layers.push(layer);
    this.startSource(layer);
  }

  toggleMute(id: number) {
    const l = this.layers.find((x) => x.id === id);
    if (!l) return;
    l.muted = !l.muted;
    l.gain.gain.setTargetAtTime(l.muted ? 0 : 1, this.ctx.currentTime, 0.01);
    this.emit();
  }

  removeLayer(id: number) {
    const i = this.layers.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [l] = this.layers.splice(i, 1);
    try {
      l.src?.stop();
    } catch {
      // вже зупинено
    }
    l.gain.disconnect();
    if (!this.layers.length) this.clear();
    else this.emit();
  }

  clear() {
    this.cancelLayer();
    this.stopBase();
    for (const l of this.layers) {
      try {
        l.src?.stop();
      } catch {
        // вже зупинено
      }
      l.gain.disconnect();
    }
    this.layers = [];
    this.duration = 0;
    this.phase = 'idle';
    this.emit();
  }

  dispose() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.endCapture();
    for (const l of this.layers) {
      try {
        l.src?.stop();
      } catch {
        // вже зупинено
      }
    }
    this.layers = [];
    this.bus.disconnect();
    this.phase = 'idle';
  }
}
