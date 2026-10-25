// Музична теорія та допоміжні функції синтезу

export type ScaleId = 'major' | 'minor' | 'pentatonic' | 'dorian' | 'blues';

export const SCALES: Record<ScaleId, { name: string; steps: number[] }> = {
  major: { name: 'Мажор', steps: [0, 2, 4, 5, 7, 9, 11] },
  minor: { name: 'Мінор', steps: [0, 2, 3, 5, 7, 8, 10] },
  pentatonic: { name: 'Пентатоніка', steps: [0, 2, 4, 7, 9] },
  dorian: { name: 'Дорійський', steps: [0, 2, 3, 5, 7, 9, 10] },
  blues: { name: 'Блюз', steps: [0, 3, 5, 6, 7, 10] },
};

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToFreq(midi: number) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function freqToLabel(freq: number) {
  if (!freq || freq <= 0) return '—';
  const midi = Math.round(69 + 12 * Math.log2(freq / 440));
  return NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
}

// Нота (MIDI) за номером ступені гами. Ступінь може бути від'ємною або більшою за довжину гами
export function scaleMidi(scale: ScaleId, root: number, degree: number, baseMidi = 48) {
  const steps = SCALES[scale].steps;
  const n = steps.length;
  const octave = Math.floor(degree / n);
  const index = ((degree % n) + n) % n;
  return baseMidi + root + octave * 12 + steps[index];
}

export function scaleLength(scale: ScaleId) {
  return SCALES[scale].steps.length;
}

// Підпис акорду: коренева нота + якість (m / dim / без підпису)
export function chordLabel(midis: number[]) {
  const rootMidi = midis[0];
  const third = midis[1] - midis[0];
  const fifth = midis[2] - midis[0];
  let quality = '';
  if (third === 3 && fifth === 7) quality = 'm';
  else if (third === 3 && fifth === 6) quality = 'dim';
  else if (third === 4 && fifth === 8) quality = 'aug';
  return NOTE_NAMES[((rootMidi % 12) + 12) % 12] + quality;
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function clamp01(v: number) {
  return clamp(v, 0, 1);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// ---------- Ревербератор ----------

export function createReverbImpulse(ctx: AudioContext, seconds = 2.4, decay = 2.6) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

// ---------- Karplus-Strong (струна) ----------

export function makePluckBuffer(ctx: AudioContext, freq: number, damping: number, seconds = 2.4) {
  const sr = ctx.sampleRate;
  const period = Math.max(2, Math.round(sr / freq));
  const length = Math.floor(sr * seconds);
  const buffer = ctx.createBuffer(1, length, sr);
  const out = buffer.getChannelData(0);

  const line = new Float32Array(period);
  let prev = 0;
  for (let i = 0; i < period; i++) {
    const noise = Math.random() * 2 - 1;
    prev = prev * 0.35 + noise * 0.65; // трохи згладжуємо шум — м'якший початок
    line[i] = prev;
  }

  let idx = 0;
  for (let i = 0; i < length; i++) {
    const cur = line[idx];
    const next = line[(idx + 1) % period];
    out[i] = cur;
    line[idx] = (cur + next) * 0.5 * damping;
    idx = (idx + 1) % period;
  }

  const fade = Math.floor(sr * 0.08);
  for (let i = 0; i < fade; i++) {
    out[length - 1 - i] *= i / fade;
  }
  return buffer;
}

// ---------- Джерело тону: осцилятор(и) або петля з власного семпла ----------

export class ToneSource {
  out: GainNode;
  detuneParams: AudioParam[] = [];
  private sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private sampleMode: boolean;
  private baseFreq: number;
  private ctx: AudioContext;

  constructor(
    ctx: AudioContext,
    wave: OscillatorType,
    detunes: number[],
    sample: AudioBuffer | null,
    baseFreq: number
  ) {
    this.ctx = ctx;
    this.baseFreq = baseFreq;
    this.sampleMode = !!sample;
    this.out = ctx.createGain();

    if (sample) {
      const src = ctx.createBufferSource();
      src.buffer = sample;
      src.loop = true;
      src.connect(this.out);
      src.start();
      this.sources.push(src);
      this.detuneParams.push(src.detune);
    } else {
      const mix = 1 / Math.sqrt(detunes.length);
      detunes.forEach((cents) => {
        const osc = ctx.createOscillator();
        osc.type = wave;
        osc.detune.value = cents;
        const g = ctx.createGain();
        g.gain.value = mix;
        osc.connect(g);
        g.connect(this.out);
        osc.start();
        this.sources.push(osc);
        this.detuneParams.push(osc.detune);
      });
    }
  }

  setFreq(freq: number, timeConstant = 0.02) {
    const now = this.ctx.currentTime;
    this.sources.forEach((s) => {
      if (this.sampleMode) {
        (s as AudioBufferSourceNode).playbackRate.setTargetAtTime(
          clamp(freq / this.baseFreq, 0.25, 4),
          now,
          timeConstant
        );
      } else {
        (s as OscillatorNode).frequency.setTargetAtTime(freq, now, timeConstant);
      }
    });
  }

  stop() {
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        // вже зупинено
      }
    });
    setTimeout(() => this.out.disconnect(), 100);
  }
}

// ---------- Ударні (синтез) ----------

export const DRUM_NAMES = ['Кік', 'Снейр', 'Хет', 'Том', 'Клеп', 'Райд'];

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function noiseHit(
  ctx: AudioContext,
  dest: AudioNode,
  filterType: BiquadFilterType,
  freq: number,
  q: number,
  vel: number,
  length: number,
  when: number
) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, length + 0.05);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vel, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(when);
  src.stop(when + length + 0.05);
}

function toneHit(
  ctx: AudioContext,
  dest: AudioNode,
  f0: number,
  f1: number,
  vel: number,
  length: number,
  when: number,
  type: OscillatorType = 'sine'
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, when);
  osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), when + length * 0.7);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vel, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + length);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(when);
  osc.stop(when + length + 0.05);
}

export function playDrum(ctx: AudioContext, id: number, vel: number, dest: AudioNode) {
  const t = ctx.currentTime;
  const v = clamp(vel, 0.15, 1);
  switch (id) {
    case 0: // кік
      toneHit(ctx, dest, 150, 42, 0.9 * v, 0.45, t);
      noiseHit(ctx, dest, 'lowpass', 400, 0.7, 0.15 * v, 0.03, t);
      break;
    case 1: // снейр
      toneHit(ctx, dest, 220, 120, 0.35 * v, 0.14, t, 'triangle');
      noiseHit(ctx, dest, 'highpass', 1800, 0.8, 0.55 * v, 0.2, t);
      break;
    case 2: // хет
      noiseHit(ctx, dest, 'highpass', 7000, 0.9, 0.35 * v, 0.07, t);
      break;
    case 3: // том
      toneHit(ctx, dest, 260, 110, 0.7 * v, 0.35, t);
      break;
    case 4: // клеп
      noiseHit(ctx, dest, 'bandpass', 1500, 1.2, 0.5 * v, 0.05, t);
      noiseHit(ctx, dest, 'bandpass', 1500, 1.2, 0.5 * v, 0.05, t + 0.018);
      noiseHit(ctx, dest, 'bandpass', 1500, 1.2, 0.6 * v, 0.18, t + 0.036);
      break;
    default: // райд / дзвінка
      noiseHit(ctx, dest, 'highpass', 5000, 1, 0.22 * v, 0.5, t);
      toneHit(ctx, dest, 820, 800, 0.15 * v, 0.4, t, 'square');
      break;
  }
}
