// Шість режимів гри. Кожен режим — окремий клас зі своїм звуковим ланцюжком,
// але всі отримують однакові "розпізнані" параметри руки (Hand) і спільну шину (dry + reverb).

import type { Hand } from './features';
import { DEFAULT_CALIBRATION } from './features';
import type { Calibration } from './features';
import {
  ToneSource,
  chordLabel,
  clamp,
  clamp01,
  freqToLabel,
  lerp,
  makePluckBuffer,
  midiToFreq,
  playDrum,
  scaleLength,
  scaleMidi,
  DRUM_NAMES,
} from './music';
import type { ScaleId } from './music';

export type ModeId = 'ambient' | 'lead' | 'pluck' | 'percussive' | 'theremin' | 'chord' | 'arp' | 'choir' | 'wobble';
export type ModeCategory = 'melodic' | 'chords' | 'percussive';

// Один крок «Як керувати»: що робити рукою і що станеться зі звуком
export type HowTo = { icon: string; gesture: string; effect: string };

export type ModeMeta = {
  id: ModeId;
  name: string;
  category: ModeCategory;
  color: string;
  icon: string;
  tagline: string; // одне речення: який це інструмент
  desc: string;
  howTo: HowTo[];
  tip: string; // порада, як зіграти красиво
  paramLabels: [string, string, string, string];
  usesSample: boolean;
};

export const MODES: ModeMeta[] = [
  {
    id: 'ambient',
    name: 'Ембіентний пад',
    category: 'melodic',
    color: '#19c3b1',
    icon: 'pad',
    tagline: 'Хвилі звуку, що пливуть услід за рукою',
    desc: 'Повільний оксамитовий пад. Звук не «б’є» нотами, а плавно ковзає: чим вище рука, тим вищий тон.',
    howTo: [
      { icon: 'updown', gesture: 'Піднімай і опускай руку', effect: 'Тон плавно ковзає вгору й вниз (глісандо)' },
      { icon: 'depth', gesture: 'Наближай руку до камери', effect: 'Звук стає гучнішим, віддаляєш — тихішим' },
      { icon: 'spread', gesture: 'Розводь пальці', effect: 'Звук яскравішає, з’являється простір (реверб)' },
      { icon: 'leftright', gesture: 'Рухай руку вліво-вправо', effect: 'Звук переїжджає між лівим і правим динаміком' },
    ],
    tip: 'Рухайся повільно — пад любить плавність. Покажи дві руки, і зазвучать два голоси одночасно.',
    paramLabels: ['Тон (Y — висота руки)', 'Гучність (Z — відстань)', 'Тембр (розведення пальців)', 'Ефект — реверб'],
    usesSample: true,
  },
  {
    id: 'lead',
    name: 'Лід-синт',
    category: 'melodic',
    color: '#8a63d2',
    icon: 'saw',
    tagline: 'Гострий соло-синтезатор для мелодій',
    desc: 'Монофонічний лід: кількість пальців обирає ноту гами, тож мелодія завжди звучить чисто.',
    howTo: [
      { icon: 'finger', gesture: 'Покажи від 1 до 5 пальців', effect: 'Грає відповідна нота гами (1 палець — перша, 5 — п’ята)' },
      { icon: 'updown', gesture: 'Тримай руку високо або низько', effect: 'Високо — октава вище, низько — звичайна' },
      { icon: 'fist', gesture: 'Стисни кулак', effect: 'Звук затихає (пауза), а фільтр закривається' },
      { icon: 'leftright', gesture: 'Зміщуй руку вправо', effect: 'З’являється вібрато — чим правіше, тим глибше' },
    ],
    tip: 'Спробуй пальці 1-3-5-3 — це вже мелодія. З гамою «Пентатоніка» помилитись неможливо.',
    paramLabels: ['Нота (пальці)', 'Гучність (кулак — пауза)', 'Фільтр (кулак ↔ долоня)', 'Вібрато (X — вправо)'],
    usesSample: true,
  },
  {
    id: 'pluck',
    name: 'Щипкові струни',
    category: 'melodic',
    color: '#ffb000',
    icon: 'string',
    tagline: 'Арфа з повітря: кожен палець — окрема струна',
    desc: 'Фізична модель струни (Karplus-Strong). Швидкий помах пальця — і струна дзвенить, як справжня.',
    howTo: [
      { icon: 'finger', gesture: 'Швидко смикни кінчиком пальця', effect: 'Зазвучить струна цього пальця (4 пальці — 4 струни)' },
      { icon: 'updown', gesture: 'Піднімай або опускай руку', effect: 'Вся арфа переходить у вищу чи нижчу тональність' },
      { icon: 'hold', gesture: 'Після удару тримай руку нерухомо', effect: 'Нота дзвенить довше, рух — швидко її гасить' },
      { icon: 'bolt', gesture: 'Смикай сильніше', effect: 'Удар гучніший і яскравіший' },
    ],
    tip: 'Грай як на арфі: швидко проводь рукою зліва направо, смикаючи пальцями по черзі.',
    paramLabels: ['Остання нота (висота руки)', 'Сила удару', 'Сустейн (нерухомість)', 'Ефект — реверб'],
    usesSample: true,
  },
  {
    id: 'percussive',
    name: 'Перкусія',
    category: 'percussive',
    color: '#ff4f9a',
    icon: 'drum',
    tagline: 'Барабанна установка на екрані камери',
    desc: 'Кадр розділений на 6 зон, у кожній — свій барабан (кік, снейр, хет, том, клеп, райд). Ударяй по зонах рукою.',
    howTo: [
      { icon: 'drum', gesture: 'Різко рухни рукою в зону кадру', effect: 'Пролунає барабан, підписаний у цій зоні' },
      { icon: 'bolt', gesture: 'Бий швидше', effect: 'Удар гучніший — повільний рух грає тихо' },
      { icon: 'hands', gesture: 'Підніми дві руки', effect: 'Можна грати двома руками й накладати удари' },
    ],
    tip: 'Склади біт: ліва рука — кік і снейр, права — хет. Подивись на сітку на екрані, там підписано кожен барабан.',
    paramLabels: ['Пад (зона кадру)', 'Сила удару', 'Швидкість руху', 'Ефект — реверб'],
    usesSample: true,
  },
  {
    id: 'theremin',
    name: 'Терменвокс',
    category: 'melodic',
    color: '#9bd400',
    icon: 'theremin',
    tagline: 'Звук із повітря — без жодних фіксованих нот',
    desc: 'Класичний електронний інструмент, на якому грають, не торкаючись: тон і гучність керуються лише положенням рук.',
    howTo: [
      { icon: 'updown', gesture: 'Піднімай і опускай першу руку', effect: 'Безперервно змінюється тон (немає фіксованих нот)' },
      { icon: 'hands', gesture: 'Покажи другу руку й рухай її вгору-вниз', effect: 'Друга рука керує гучністю' },
      { icon: '⤾', gesture: 'Нахиляй зап’ястя вліво чи вправо', effect: 'Звук починає тремтіти (тремоло)' },
    ],
    tip: 'Роби повільні плавні рухи. Щоб ноти були чистими, відпрацюй спершу висоту руки без нахилів.',
    paramLabels: ['Тон (Y — висота руки)', 'Гучність', 'Тембр (розкриття)', 'Тремоло (нахил)'],
    usesSample: true,
  },
  {
    id: 'chord',
    name: 'Акорди',
    category: 'chords',
    color: '#2d5bff',
    icon: 'chord',
    tagline: 'Повні акорди однією рукою',
    desc: 'Кількість пальців обирає акорд обраної тональності. З двома руками одна грає акорди, а друга — мелодію.',
    howTo: [
      { icon: 'finger', gesture: 'Покажи від 1 до 5 пальців', effect: 'Звучить акорд відповідного ступеня гами' },
      { icon: '⤾', gesture: 'Нахили долоню вліво або вправо', effect: 'Акорд змінює обернення — звучить інакше' },
      { icon: 'spread', gesture: 'Широко розведи пальці', effect: 'До акорду додається сьома нота — він стає «багатшим»' },
      { icon: 'hands', gesture: 'Покажи другу руку', effect: 'Вона грає мелодію: висота руки обирає ноту' },
    ],
    tip: 'Проста прогресія: 1 → 4 → 5 → 1 пальців. Це основа сотень пісень.',
    paramLabels: ['Акорд (пальці)', 'Гучність', 'Розведення (7-ма нота)', 'Нахил (обернення)'],
    usesSample: true,
  },
  {
    id: 'arp',
    name: 'Арпеджіо',
    category: 'chords',
    color: '#ff6a1f',
    icon: 'arp',
    tagline: 'Акорд, що сам біжить нотами в ритмі',
    desc: 'Обираєш акорд пальцями, а синтезатор сам програє його ноти одну за одною. Ти керуєш темпом і малюнком.',
    howTo: [
      { icon: 'finger', gesture: 'Покажи від 1 до 5 пальців', effect: 'Обираєш акорд, ноти якого запустяться по колу' },
      { icon: 'leftright', gesture: 'Рухай руку вліво-вправо', effect: 'Темп: ліворуч — повільно, праворуч — дуже швидко' },
      { icon: 'updown', gesture: 'Піднімай чи опускай руку', effect: 'Низько — ноти вгору, посередині — вгору-вниз, високо — випадково' },
      { icon: 'spread', gesture: 'Розводь пальці', effect: 'Ноти стають довшими, а звук яскравішим' },
      { icon: 'fist', gesture: 'Стисни кулак', effect: 'Арпеджіо зупиняється — пауза' },
    ],
    tip: 'Тримай 1 палець, повільно веди руку вправо — темп наростає, як у танцювальному треку.',
    paramLabels: ['Нота (арпеджіо)', 'Гучність', 'Довжина нот (розведення)', 'Темп (X — вправо)'],
    usesSample: false,
  },
  {
    id: 'choir',
    name: 'Хор',
    category: 'melodic',
    color: '#ff8fb8',
    icon: 'choir',
    tagline: 'Людський голос, який «співає» голосні',
    desc: 'Синтезований хор. Розкриття долоні змінює голосну — від «У» до «І», а висота руки обирає ноту гами.',
    howTo: [
      { icon: 'updown', gesture: 'Піднімай і опускай руку', effect: 'Хор співає ноти гами (без фальшивих)' },
      { icon: 'spread', gesture: 'Розкривай долоню від кулака до відкритої', effect: 'Голосна змінюється: У → О → А → Е → І' },
      { icon: 'depth', gesture: 'Наближай руку до камери', effect: 'Хор співає голосніше' },
      { icon: '⤾', gesture: 'Нахиляй зап’ястя', effect: 'З’являється вібрато, як у справжнього співака' },
    ],
    tip: 'Заспівай «А-а-а» із широко розкритою долонею, а потім повільно стискай у кулак до «У-у-у».',
    paramLabels: ['Нота (висота руки)', 'Гучність (близькість)', 'Голосна (розкриття долоні)', 'Вібрато (нахил)'],
    usesSample: true,
  },
  {
    id: 'wobble',
    name: 'Вобл-бас',
    category: 'melodic',
    color: '#35b6ff',
    icon: 'wobble',
    tagline: 'Важкий бас, що «гойдається» як у даб-степі',
    desc: 'Потужний бас із фільтром, який хвилею відкривається й закривається. Швидкість «воблу» задаєш положенням руки.',
    howTo: [
      { icon: 'finger', gesture: 'Покажи від 1 до 5 пальців', effect: 'Грає нота басу (1 палець — найнижча)' },
      { icon: 'leftright', gesture: 'Рухай руку вліво-вправо', effect: 'Швидкість воблу: ліворуч — повільно, праворуч — шалено' },
      { icon: 'updown', gesture: 'Піднімай руку', effect: 'Вобл глибший і яскравіший, внизу — глухий бас' },
      { icon: 'spread', gesture: 'Розводь пальці', effect: 'Резонанс зростає — бас «кричить»' },
      { icon: 'fist', gesture: 'Стисни кулак', effect: 'Бас затихає — використовуй як паузу для «дропу»' },
    ],
    tip: 'Тримай 1 палець біля лівого краю, а потім різко відкрий долоню й повези руку вправо — це «дроп».',
    paramLabels: ['Нота-бас (пальці)', 'Гучність (кулак — пауза)', 'Резонанс (розведення)', 'Швидкість воблу (X)'],
    usesSample: false,
  },
];

export function getModeMeta(id: string): ModeMeta {
  return MODES.find((m) => m.id === id) || MODES[0];
}

// Старі пресети мали інші ідентифікатори — перетворюємо на нові
export function normalizeModeId(id: string | undefined | null): ModeId {
  if (id && MODES.some((m) => m.id === id)) return id as ModeId;
  if (id === 'soft') return 'theremin';
  return 'ambient';
}

export type WaveChoice = 'auto' | 'sine' | 'triangle' | 'square' | 'sawtooth';

export type Opts = {
  scale: ScaleId;
  root: number;
  reverb: number; // 0–100
  echo: number; // 0–100: кількість «луни»
  tone: number; // 0–100: яскравість (фільтр на виході)
  volume: number; // 0–100: загальна гучність
  wave: WaveChoice; // форма хвилі: auto — як задумав режим
};

export const DEFAULT_OPTS: Opts = { scale: 'minor', root: 9, reverb: 50, echo: 0, tone: 100, volume: 85, wave: 'auto' };

export type LiveParams = {
  freq: number;
  pitchLabel: string;
  pitch: number; // 0…1
  volume: number;
  timbre: number;
  fx: number;
  gesture: string;
  fingers: number;
  hands: number;
  hint: string;
};

export function emptyParams(): LiveParams {
  return {
    freq: 0,
    pitchLabel: '—',
    pitch: 0,
    volume: 0,
    timbre: 0,
    fx: 0,
    gesture: 'Руку не видно',
    fingers: 0,
    hands: 0,
    hint: 'Покажи руку в камеру',
  };
}

export type Spawn = { x: number; y: number; color: string; count: number };

export type Env = {
  ctx: AudioContext;
  dry: AudioNode;
  wet: AudioNode;
  getOpts: () => Opts;
  getCal: () => Calibration;
  getSample: () => AudioBuffer | null;
};

export interface ModeVoice {
  params: LiveParams;
  update(hands: Hand[], now: number): Spawn[];
  drawOverlay?(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  stop(): void;
}

const SAMPLE_BASE = 261.63;

// Якщо користувач вибрав «характер» звуку — використовуємо його замість хвилі за замовчуванням
function pickWave(env: Env, fallback: OscillatorType): OscillatorType {
  const w = env.getOpts().wave;
  return w && w !== 'auto' ? w : fallback;
}

// ---------- допоміжне ----------

class Smooth {
  v: number;
  constructor(init = 0) {
    this.v = init;
  }
  step(target: number, alpha: number) {
    this.v += (target - this.v) * alpha;
    return this.v;
  }
}

function alphaOf(cal: Calibration, factor = 1) {
  return clamp(lerp(0.7, 0.07, cal.smoothing / 100) * factor, 0.02, 1);
}

function setParam(param: AudioParam, value: number, ctx: AudioContext, tc = 0.03) {
  param.setTargetAtTime(value, ctx.currentTime, tc);
}

type Chain = {
  filter: BiquadFilterNode;
  gain: GainNode;
  pan: StereoPannerNode;
  send: GainNode;
  dispose: () => void;
};

function makeChain(env: Env, filterType: BiquadFilterType = 'lowpass', cutoff = 2500): Chain {
  const { ctx } = env;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = cutoff;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const pan = ctx.createStereoPanner();
  const send = ctx.createGain();
  send.gain.value = 0;

  filter.connect(gain);
  gain.connect(pan);
  pan.connect(env.dry);
  gain.connect(send);
  send.connect(env.wet);

  return {
    filter,
    gain,
    pan,
    send,
    dispose: () => {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.06);
      setTimeout(() => {
        filter.disconnect();
        gain.disconnect();
        pan.disconnect();
        send.disconnect();
      }, 500);
    },
  };
}

function baseParams(hands: Hand[]): LiveParams {
  const p = emptyParams();
  p.hands = hands.length;
  if (hands.length) {
    p.gesture = hands[0].f.gesture;
    p.fingers = hands[0].f.fingers;
  }
  return p;
}

// ============================================================
// 1. Ембіентний пад
// ============================================================

type PadVoice = {
  tone: ToneSource;
  chain: Chain;
  height: Smooth;
  vol: Smooth;
  cutoff: Smooth;
  rev: Smooth;
  pan: Smooth;
};

class AmbientMode implements ModeVoice {
  params = emptyParams();
  private env: Env;
  private voices = new Map<number, PadVoice>();

  constructor(env: Env) {
    this.env = env;
  }

  private createVoice(): PadVoice {
    const { ctx } = this.env;
    const tone = new ToneSource(ctx, pickWave(this.env, 'triangle'), [-9, 9], this.env.getSample(), SAMPLE_BASE);
    const chain = makeChain(this.env, 'lowpass', 1500);
    tone.out.connect(chain.filter);
    return {
      tone,
      chain,
      height: new Smooth(0.5),
      vol: new Smooth(0),
      cutoff: new Smooth(1200),
      rev: new Smooth(0.2),
      pan: new Smooth(0),
    };
  }

  private disposeVoice(v: PadVoice) {
    v.tone.stop();
    v.chain.dispose();
  }

  update(hands: Hand[]): Spawn[] {
    const { ctx } = this.env;
    const cal = this.env.getCal();
    const a = alphaOf(cal, 0.6);
    const revMul = this.env.getOpts().reverb / 50;

    for (const [slot, v] of this.voices) {
      if (!hands.some((h) => h.slot === slot)) {
        this.disposeVoice(v);
        this.voices.delete(slot);
      }
    }

    const p = baseParams(hands);

    hands.forEach((h, idx) => {
      let v = this.voices.get(h.slot);
      if (!v) {
        v = this.createVoice();
        this.voices.set(h.slot, v);
      }
      const f = h.f;
      const height = v.height.step(f.height, a);
      const freq = 130 * Math.pow(4, height);
      v.tone.setFreq(freq, 0.05);

      const vol = v.vol.step(lerp(0.06, 0.3, f.proximity) * (0.25 + 0.75 * f.openness), a);
      setParam(v.chain.gain.gain, vol, ctx, 0.05);

      const cutoff = v.cutoff.step(400 + f.spread * 3600, a);
      setParam(v.chain.filter.frequency, cutoff, ctx);

      const rev = v.rev.step((0.15 + f.spread * 0.7) * revMul, a);
      setParam(v.chain.send.gain, clamp(rev, 0, 1.4), ctx);

      const pan = v.pan.step((f.dx - 0.5) * 1.4, a);
      setParam(v.chain.pan.pan, clamp(pan, -1, 1), ctx);

      if (idx === 0) {
        p.freq = freq;
        p.pitchLabel = freqToLabel(freq);
        p.pitch = height;
        p.volume = vol / 0.3;
        p.timbre = f.spread;
        p.fx = clamp01(rev / 1.0);
        p.hint = `Висота руки → Тон: ${p.pitchLabel}`;
      }
    });

    this.params = p;
    return [];
  }

  stop() {
    this.voices.forEach((v) => this.disposeVoice(v));
    this.voices.clear();
  }
}

// ============================================================
// 2. Лід-синт
// ============================================================

class LeadMode implements ModeVoice {
  params = emptyParams();
  private env: Env;
  private tone: ToneSource;
  private chain: Chain;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private degree = 0;
  private octave = 0;
  private lastLabelDegree = -1;

  constructor(env: Env) {
    this.env = env;
    const { ctx } = env;
    this.tone = new ToneSource(ctx, pickWave(env, 'sawtooth'), [-7, 7], env.getSample(), SAMPLE_BASE);
    this.chain = makeChain(env, 'lowpass', 2000);
    this.chain.filter.Q.value = 5;
    this.tone.out.connect(this.chain.filter);

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 5.5;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.tone.detuneParams.forEach((d) => this.lfoGain.connect(d));
    this.lfo.start();
    this.tone.setFreq(440, 0.01);
  }

  update(hands: Hand[]): Spawn[] {
    const { ctx } = this.env;
    const opts = this.env.getOpts();
    const spawns: Spawn[] = [];
    const p = baseParams(hands);
    const h = hands[0];
    const revMul = opts.reverb / 50;

    if (!h) {
      setParam(this.chain.gain.gain, 0, ctx, 0.08);
      this.params = p;
      return spawns;
    }

    const f = h.f;
    const len = scaleLength(opts.scale);
    const gate = f.fingers > 0;
    if (gate) this.degree = f.fingers - 1;

    if (f.height > 0.6) this.octave = 1;
    else if (f.height < 0.4) this.octave = 0;

    const midi = scaleMidi(opts.scale, opts.root, this.degree + this.octave * len, 60);
    const freq = midiToFreq(midi);
    this.tone.setFreq(freq, 0.03);

    const depth = lerp(0, 55, f.dx);
    setParam(this.lfoGain.gain, depth, ctx, 0.1);

    const cutoff = 350 * Math.pow(18.6, f.openness);
    setParam(this.chain.filter.frequency, cutoff, ctx, 0.04);

    setParam(this.chain.gain.gain, gate ? 0.26 : 0, ctx, gate ? 0.015 : 0.09);
    setParam(this.chain.send.gain, 0.2 * revMul, ctx);
    setParam(this.chain.pan.pan, clamp((f.dx - 0.5) * 0.6, -1, 1), ctx);

    const noteKey = this.degree + this.octave * 100;
    if (gate && noteKey !== this.lastLabelDegree) {
      this.lastLabelDegree = noteKey;
      spawns.push({ x: h.f.rawX, y: h.f.rawY, color: '#8b6cff', count: 6 });
    }

    p.freq = freq;
    p.pitchLabel = freqToLabel(freq);
    p.pitch = clamp01((midi - 60) / 24);
    p.volume = gate ? 0.75 : 0;
    p.timbre = f.openness;
    p.fx = f.dx;
    p.hint = `Пальців: ${f.fingers} → Нота: ${p.pitchLabel}`;
    this.params = p;
    return spawns;
  }

  stop() {
    this.tone.stop();
    this.chain.dispose();
    try {
      this.lfo.stop();
    } catch {
      // вже зупинено
    }
  }
}

// ============================================================
// 3. Щипкові струни
// ============================================================

const FINGER_TIPS = [8, 12, 16, 20];
const STRING_OFFSETS = [0, 2, 4, 6];
const FLICK_SPEED = 1.7;

class PluckMode implements ModeVoice {
  params = emptyParams();
  private env: Env;
  private lastHit = new Map<number, number>();
  private wasPinch = new Map<number, boolean>();
  private lastStrum = new Map<number, number>();
  private lastFreq = 0;
  private lastVel = 0;
  private lastBase = 0;
  private lastStill = 0.5;

  constructor(env: Env) {
    this.env = env;
  }

  private pluck(freq: number, vel: number, pan: number, damping: number) {
    const { ctx } = this.env;
    const revMul = this.env.getOpts().reverb / 50;
    const sample = this.env.getSample();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    const send = ctx.createGain();
    const now = ctx.currentTime;

    if (sample) {
      src.buffer = sample;
      src.playbackRate.value = clamp(freq / SAMPLE_BASE, 0.25, 4);
      gain.gain.setValueAtTime(0.6 * vel, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + lerp(0.8, 3, (damping - 0.9925) / 0.006));
    } else {
      src.buffer = makePluckBuffer(ctx, freq, damping);
      gain.gain.value = 0.7 * vel;
    }
    panner.pan.value = clamp(pan, -1, 1);
    send.gain.value = 0.28 * revMul;

    src.connect(gain);
    gain.connect(panner);
    panner.connect(this.env.dry);
    gain.connect(send);
    send.connect(this.env.wet);
    src.start(now);
    src.stop(now + 3.2);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
      panner.disconnect();
      send.disconnect();
    };
  }

  update(hands: Hand[], now: number): Spawn[] {
    const opts = this.env.getOpts();
    const spawns: Spawn[] = [];
    const p = baseParams(hands);

    hands.forEach((h) => {
      const f = h.f;
      const baseDegree = Math.floor(f.height * 5);
      const still = clamp01(1 - h.palmSpeed / 1.2);
      const damping = lerp(0.9925, 0.9985, still);
      const pan = (f.dx - 0.5) * 1.2;
      this.lastBase = baseDegree / 4;
      this.lastStill = still;

      const strum = h.palmVy > 2.6 && now - (this.lastStrum.get(h.slot) ?? 0) > 450;
      if (strum) {
        this.lastStrum.set(h.slot, now);
        STRING_OFFSETS.forEach((off, i) => {
          const freq = midiToFreq(scaleMidi(opts.scale, opts.root, baseDegree + off, 52));
          setTimeout(() => this.pluck(freq, 0.7, pan, damping), i * 35);
          this.lastHit.set(h.slot * 4 + i, now);
        });
        spawns.push({ x: f.rawX, y: f.rawY, color: '#ffb347', count: 14 });
        this.lastFreq = midiToFreq(scaleMidi(opts.scale, opts.root, baseDegree + 6, 52));
        this.lastVel = 0.8;
      }

      FINGER_TIPS.forEach((tip, i) => {
        const key = h.slot * 4 + i;
        const rel = h.tipVy[i] - h.palmVy;
        const pinching = f.pinch[i] < 0.5;
        const wasPinching = this.wasPinch.get(key) ?? false;
        this.wasPinch.set(key, pinching);

        const canHit = now - (this.lastHit.get(key) ?? 0) > 220;
        const flick = rel > FLICK_SPEED;
        if (canHit && ((pinching && !wasPinching) || flick)) {
          const vel = flick ? clamp(rel / 4.5, 0.35, 1) : 0.7;
          const freq = midiToFreq(scaleMidi(opts.scale, opts.root, baseDegree + STRING_OFFSETS[i], 52));
          this.pluck(freq, vel, pan, damping);
          this.lastHit.set(key, now);
          this.lastFreq = freq;
          this.lastVel = vel;
          spawns.push({ x: h.lm[tip].x, y: h.lm[tip].y, color: '#ffb347', count: 9 });
        }
      });
    });

    this.lastVel *= 0.96;
    p.freq = this.lastFreq;
    p.pitchLabel = this.lastFreq ? freqToLabel(this.lastFreq) : '—';
    p.pitch = this.lastBase;
    p.volume = this.lastVel;
    p.timbre = this.lastStill;
    p.fx = clamp01(this.env.getOpts().reverb / 100);
    p.hint = hands.length ? 'Щипок або помах пальця → удар по струні' : p.hint;
    this.params = p;
    return spawns;
  }

  stop() {
    // окремі удари доспівають самі
  }
}

// ============================================================
// 4. Перкусія
// ============================================================

const COLS = 3;
const ROWS = 2;
const HIT_SPEED = 1.2;
const SAMPLE_RATIOS = [0.5, 0.667, 0.84, 1, 1.26, 1.5];

class PercussiveMode implements ModeVoice {
  params = emptyParams();
  private env: Env;
  private bus: GainNode;
  private send: GainNode;
  private fast = new Map<number, boolean>();
  private flash: number[] = [0, 0, 0, 0, 0, 0];
  private lastPad = -1;
  private lastVel = 0;
  private lastSpeed = 0;

  constructor(env: Env) {
    this.env = env;
    this.bus = env.ctx.createGain();
    this.bus.gain.value = 1;
    this.send = env.ctx.createGain();
    this.send.gain.value = 0.18;
    this.bus.connect(env.dry);
    this.bus.connect(this.send);
    this.send.connect(env.wet);
  }

  private hit(pad: number, vel: number) {
    const { ctx } = this.env;
    const sample = this.env.getSample();
    if (sample) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      src.buffer = sample;
      src.playbackRate.value = SAMPLE_RATIOS[pad];
      gain.gain.value = 0.8 * vel;
      src.connect(gain);
      gain.connect(this.bus);
      src.start();
      src.stop(ctx.currentTime + Math.min(sample.duration / SAMPLE_RATIOS[pad], 2.5));
      src.onended = () => {
        src.disconnect();
        gain.disconnect();
      };
    } else {
      playDrum(ctx, pad, vel, this.bus);
    }
  }

  update(hands: Hand[], now: number): Spawn[] {
    const spawns: Spawn[] = [];
    const p = baseParams(hands);
    setParam(this.send.gain, 0.18 * (this.env.getOpts().reverb / 50), this.env.ctx);

    for (const slot of [...this.fast.keys()]) {
      if (!hands.some((h) => h.slot === slot)) this.fast.delete(slot);
    }

    hands.forEach((h) => {
      const col = Math.min(COLS - 1, Math.floor(h.f.dx * COLS));
      const row = h.f.height > 0.5 ? 0 : 1;
      const pad = row * COLS + col;
      const wasFast = this.fast.get(h.slot) ?? false;
      this.lastSpeed = h.palmSpeed;

      if (h.palmSpeed > HIT_SPEED && !wasFast) {
        const vel = clamp(h.palmSpeed / 3.5, 0.25, 1);
        this.hit(pad, vel);
        this.flash[pad] = now;
        this.lastPad = pad;
        this.lastVel = vel;
        spawns.push({ x: h.f.rawX, y: h.f.rawY, color: '#ff4fc3', count: 14 });
        this.fast.set(h.slot, true);
      } else if (h.palmSpeed < HIT_SPEED * 0.5) {
        this.fast.set(h.slot, false);
      }
    });

    this.lastVel *= 0.95;
    p.pitchLabel = this.lastPad >= 0 ? DRUM_NAMES[this.lastPad] : '—';
    p.pitch = this.lastPad >= 0 ? this.lastPad / 5 : 0;
    p.volume = this.lastVel;
    p.timbre = clamp01(this.lastSpeed / 3.5);
    p.fx = clamp01(this.env.getOpts().reverb / 100);
    p.hint = 'Різкий рух у зону → удар';
    this.params = p;
    return spawns;
  }

  drawOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const now = performance.now();
    ctx.save();
    ctx.lineWidth = 1.5;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const pad = r * COLS + c;
        // полотно віддзеркалене CSS-ом, тож стовпці перераховуємо в "сирі" координати
        const x0 = (1 - (c + 1) / COLS) * w;
        const cw = w / COLS;
        const y0 = (r * h) / ROWS;
        const ch = h / ROWS;
        const age = now - this.flash[pad];
        const glow = age < 350 ? 1 - age / 350 : 0;

        ctx.fillStyle = `rgba(255, 79, 195, ${0.05 + glow * 0.4})`;
        ctx.strokeStyle = `rgba(255, 79, 195, ${0.25 + glow * 0.7})`;
        ctx.beginPath();
        ctx.roundRect(x0 + 6, y0 + 6, cw - 12, ch - 12, 14);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(x0 + cw / 2, y0 + ch / 2);
        ctx.scale(-1, 1);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.45 + glow * 0.55})`;
        ctx.font = '600 20px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(DRUM_NAMES[pad], 0, 0);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  stop() {
    this.bus.disconnect();
    this.send.disconnect();
  }
}

// ============================================================
// 5. Терменвокс
// ============================================================

class ThereminMode implements ModeVoice {
  params = emptyParams();
  private env: Env;
  private tone: ToneSource;
  private chain: Chain;
  private trem: GainNode;
  private lfo: OscillatorNode;
  private lfoAmp: GainNode;
  private height = new Smooth(0.5);
  private vol = new Smooth(0);

  constructor(env: Env) {
    this.env = env;
    const { ctx } = env;
    this.tone = new ToneSource(ctx, pickWave(env, 'sine'), [0], env.getSample(), SAMPLE_BASE);
    this.chain = makeChain(env, 'lowpass', 5000);
    this.trem = ctx.createGain();
    this.trem.gain.value = 1;
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 6;
    this.lfoAmp = ctx.createGain();
    this.lfoAmp.gain.value = 0;
    this.lfo.connect(this.lfoAmp);
    this.lfoAmp.connect(this.trem.gain);
    this.lfo.start();
    this.tone.out.connect(this.trem);
    this.trem.connect(this.chain.filter);
    this.tone.setFreq(220, 0.01);
  }

  update(hands: Hand[]): Spawn[] {
    const { ctx } = this.env;
    const cal = this.env.getCal();
    const a = alphaOf(cal, 0.7);
    const p = baseParams(hands);
    const revMul = this.env.getOpts().reverb / 50;

    const pitchHand = hands.find((h) => h.slot === 0) || hands[0];
    const volHand = hands.length > 1 ? hands.find((h) => h.slot === 1) : undefined;

    if (!pitchHand) {
      this.vol.step(0, 0.3);
      setParam(this.chain.gain.gain, 0, ctx, 0.08);
      this.params = p;
      return [];
    }

    const f = pitchHand.f;
    const height = this.height.step(f.height, a);
    const freq = 110 * Math.pow(2, 3 * height);
    this.tone.setFreq(freq, 0.04);

    let targetVol: number;
    if (volHand) {
      targetVol = lerp(0, 0.4, volHand.f.height);
    } else {
      targetVol = lerp(0.04, 0.36, f.proximity) * (0.35 + 0.65 * f.openness);
    }
    const vol = this.vol.step(targetVol, a);
    setParam(this.chain.gain.gain, vol, ctx, 0.04);

    const depth = clamp01((Math.abs(f.tilt) - 0.15) * 1.6);
    setParam(this.trem.gain, 1 - depth / 2, ctx, 0.05);
    setParam(this.lfoAmp.gain, depth / 2, ctx, 0.05);

    setParam(this.chain.send.gain, 0.3 * revMul, ctx);
    setParam(this.chain.pan.pan, clamp((f.dx - 0.5) * 0.8, -1, 1), ctx);

    p.freq = freq;
    p.pitchLabel = freqToLabel(freq);
    p.pitch = height;
    p.volume = vol / 0.4;
    p.timbre = f.openness;
    p.fx = depth;
    p.hint = volHand ? `Права рука → Тон: ${p.pitchLabel} · ліва → гучність` : `Висота руки → Тон: ${p.pitchLabel}`;
    this.params = p;
    return [];
  }

  stop() {
    this.tone.stop();
    this.chain.dispose();
    try {
      this.lfo.stop();
    } catch {
      // вже зупинено
    }
  }
}

// ============================================================
// 6. Акорди
// ============================================================

type ChordGroup = { key: string; tones: ToneSource[]; chain: Chain };

class ChordMode implements ModeVoice {
  params = emptyParams();
  private env: Env;
  private active: ChordGroup | null = null;
  private candKey = 'none';
  private candSince = 0;
  private melodyTone: ToneSource | null = null;
  private melodyChain: Chain | null = null;
  private lastName = '—';
  private lastDegree = 0;

  constructor(env: Env) {
    this.env = env;
  }

  private releaseActive() {
    if (!this.active) return;
    const group = this.active;
    const now = this.env.ctx.currentTime;
    group.chain.gain.gain.cancelScheduledValues(now);
    group.chain.gain.gain.setTargetAtTime(0, now, 0.1);
    setTimeout(() => {
      group.tones.forEach((t) => t.stop());
      group.chain.dispose();
    }, 600);
    this.active = null;
  }

  private startChord(key: string, midis: number[]) {
    const { ctx } = this.env;
    const chain = makeChain(this.env, 'lowpass', 2400);
    const revMul = this.env.getOpts().reverb / 50;
    const tones = midis.map((m) => {
      const t = new ToneSource(ctx, pickWave(this.env, 'triangle'), [-6, 6], this.env.getSample(), SAMPLE_BASE);
      t.setFreq(midiToFreq(m), 0.001);
      t.out.connect(chain.filter);
      return t;
    });
    chain.send.gain.value = 0.35 * revMul;
    const now = ctx.currentTime;
    chain.gain.gain.setValueAtTime(0, now);
    chain.gain.gain.setTargetAtTime(0.2, now, 0.04);
    this.active = { key, tones, chain };
  }

  update(hands: Hand[], now: number): Spawn[] {
    const { ctx } = this.env;
    const opts = this.env.getOpts();
    const spawns: Spawn[] = [];
    const p = baseParams(hands);
    const len = scaleLength(opts.scale);

    const chordHand = hands.length > 1 ? hands.find((h) => h.slot === 1) : hands[0];
    const melodyHand = hands.length > 1 ? hands.find((h) => h.slot === 0) : undefined;

    // ----- акорд -----
    let key = 'none';
    let midis: number[] = [];
    let label = '—';
    if (chordHand && chordHand.f.fingers > 0) {
      const f = chordHand.f;
      const degree = f.fingers - 1;
      const triad = [0, 2, 4].map((o) => scaleMidi(opts.scale, opts.root, degree + o, 48));
      label = chordLabel(triad);
      midis = [...triad];
      const seventh = f.spread > 0.85;
      if (seventh) midis.push(scaleMidi(opts.scale, opts.root, degree + 6, 48));
      const inv = f.tilt < -0.35 ? 1 : f.tilt > 0.35 ? 2 : 0;
      for (let i = 0; i < inv; i++) midis[i] += 12;
      key = `${degree}-${inv}-${seventh ? 7 : 3}-${opts.scale}-${opts.root}`;
      this.lastDegree = degree;
    }

    if (key !== this.candKey) {
      this.candKey = key;
      this.candSince = now;
    }
    const activeKey = this.active ? this.active.key : 'none';
    if (now - this.candSince > 130 && this.candKey !== activeKey) {
      this.releaseActive();
      if (this.candKey !== 'none' && chordHand) {
        this.startChord(this.candKey, midis);
        spawns.push({ x: chordHand.f.rawX, y: chordHand.f.rawY, color: '#6a7dff', count: 12 });
      }
    }
    if (key !== 'none') this.lastName = label;

    // ----- мелодія (друга рука) -----
    if (melodyHand) {
      if (!this.melodyTone) {
        this.melodyTone = new ToneSource(ctx, pickWave(this.env, 'triangle'), [0], this.env.getSample(), SAMPLE_BASE);
        this.melodyChain = makeChain(this.env, 'lowpass', 3500);
        this.melodyTone.out.connect(this.melodyChain.filter);
        this.melodyTone.setFreq(440, 0.001);
      }
      const f = melodyHand.f;
      const degree = Math.floor(f.height * len * 1.999);
      const midi = scaleMidi(opts.scale, opts.root, degree, 60);
      this.melodyTone.setFreq(midiToFreq(midi), 0.02);
      const gate = f.openness > 0.2;
      setParam(this.melodyChain!.gain.gain, gate ? 0.2 : 0, ctx, gate ? 0.02 : 0.08);
      setParam(this.melodyChain!.send.gain, 0.25 * (opts.reverb / 50), ctx);
      setParam(this.melodyChain!.pan.pan, clamp((f.dx - 0.5) * 0.6, -1, 1), ctx);
    } else if (this.melodyTone && this.melodyChain) {
      setParam(this.melodyChain.gain.gain, 0, ctx, 0.08);
    }

    const root = midis.length ? midiToFreq(midis[0]) : 0;
    p.freq = root;
    p.pitchLabel = this.lastName;
    p.pitch = this.lastDegree / 6;
    p.volume = this.active ? 0.7 : 0;
    p.timbre = chordHand ? chordHand.f.spread : 0;
    p.fx = chordHand ? clamp01(Math.abs(chordHand.f.tilt)) : 0;
    p.hint = this.active ? `Пальців: ${chordHand?.f.fingers ?? 0} → Акорд: ${this.lastName}` : 'Покажи 1–5 пальців — вибери акорд';
    if (hands.length) p.gesture = chordHand ? chordHand.f.gesture : hands[0].f.gesture;
    this.params = p;
    return spawns;
  }

  stop() {
    this.releaseActive();
    if (this.melodyTone) {
      this.melodyTone.stop();
      this.melodyChain?.dispose();
      this.melodyTone = null;
      this.melodyChain = null;
    }
  }
}

// ============================================================
// 7. Арпеджіо
// ============================================================

const ARP_STEPS = [0, 2, 4, -1]; // ноти акорду (в ступенях гами): 1-3-5 і октава (-1 = повна довжина гами)

class ArpMode implements ModeVoice {
  params = emptyParams();
  private env: Env;
  private chain: Chain;
  private nextTime = 0;
  private step = 0;
  private dir = 1;
  private lastFreq = 0;

  constructor(env: Env) {
    this.env = env;
    this.chain = makeChain(env, 'lowpass', 3000);
    this.chain.gain.gain.value = 1;
  }

  private playNote(time: number, freq: number, len: number, level: number) {
    const { ctx } = this.env;
    const osc = ctx.createOscillator();
    osc.type = pickWave(this.env, 'square');
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(level, time + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, time + len);
    osc.connect(g);
    g.connect(this.chain.filter);
    osc.start(time);
    osc.stop(time + len + 0.05);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  update(hands: Hand[]): Spawn[] {
    const { ctx } = this.env;
    const opts = this.env.getOpts();
    const spawns: Spawn[] = [];
    const p = baseParams(hands);
    const h = hands[0];
    const len = scaleLength(opts.scale);

    if (!h || h.f.fingers === 0) {
      this.nextTime = 0;
      this.step = 0;
      this.dir = 1;
      this.params = p;
      p.hint = h ? 'Кулак — пауза. Покажи 1–5 пальців, щоб запустити арпеджіо' : p.hint;
      return spawns;
    }

    const f = h.f;
    const degree = f.fingers - 1;
    const bpm = lerp(70, 220, f.dx);
    const stepDur = 60 / bpm / 2;
    const mode = f.height > 0.66 ? 'rand' : f.height > 0.33 ? 'pingpong' : 'up';
    const noteLen = stepDur * lerp(0.35, 1.5, f.spread);
    const cutoff = 700 + f.spread * 4300;
    setParam(this.chain.filter.frequency, cutoff, ctx, 0.05);
    setParam(this.chain.send.gain, 0.22 * (opts.reverb / 50), ctx);
    setParam(this.chain.pan.pan, clamp((f.dx - 0.5) * 0.5, -1, 1), ctx);

    if (this.nextTime < ctx.currentTime - 0.1 || this.nextTime === 0) this.nextTime = ctx.currentTime + 0.03;

    while (this.nextTime < ctx.currentTime + 0.12) {
      let idx = this.step;
      if (mode === 'rand') idx = Math.floor(Math.random() * ARP_STEPS.length);
      const off = ARP_STEPS[idx] < 0 ? len : ARP_STEPS[idx];
      const midi = scaleMidi(opts.scale, opts.root, degree + off, 55);
      this.lastFreq = midiToFreq(midi);
      this.playNote(this.nextTime, this.lastFreq, noteLen, 0.2);
      spawns.push({ x: f.rawX, y: f.rawY, color: '#ff8a4c', count: 2 });

      if (mode === 'pingpong') {
        this.step += this.dir;
        if (this.step >= ARP_STEPS.length - 1) this.dir = -1;
        if (this.step <= 0) this.dir = 1;
      } else {
        this.step = (this.step + 1) % ARP_STEPS.length;
      }
      this.nextTime += stepDur;
    }

    p.freq = this.lastFreq;
    p.pitchLabel = freqToLabel(this.lastFreq);
    p.pitch = clamp01(this.step / (ARP_STEPS.length - 1));
    p.volume = 0.75;
    p.timbre = f.spread;
    p.fx = f.dx;
    const patName = mode === 'rand' ? 'випадково' : mode === 'pingpong' ? 'вгору-вниз' : 'вгору';
    p.hint = `Акорд ${f.fingers} · ${Math.round(bpm)} BPM · ${patName}`;
    this.params = p;
    return spawns.slice(0, 1);
  }

  stop() {
    this.chain.dispose();
  }
}

// ============================================================
// 8. Хор (формантний синтез голосних)
// ============================================================

// Частоти формант (Гц) для голосних У, О, А, Е, І
const VOWELS: { name: string; f: [number, number, number] }[] = [
  { name: 'У', f: [325, 700, 2530] },
  { name: 'О', f: [450, 800, 2830] },
  { name: 'А', f: [800, 1150, 2900] },
  { name: 'Е', f: [500, 1800, 2600] },
  { name: 'І', f: [320, 2250, 3000] },
];
const FORMANT_GAIN = [1, 0.55, 0.3];

class ChoirMode implements ModeVoice {
  params = emptyParams();
  private env: Env;
  private tone: ToneSource;
  private chain: Chain;
  private bands: BiquadFilterNode[] = [];
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private height = new Smooth(0.5);
  private vol = new Smooth(0);
  private open = new Smooth(0.5);

  constructor(env: Env) {
    this.env = env;
    const { ctx } = env;
    this.tone = new ToneSource(ctx, pickWave(env, 'sawtooth'), [-9, 0, 9], env.getSample(), SAMPLE_BASE);
    this.chain = makeChain(env, 'lowpass', 7000);
    const sum = ctx.createGain();
    sum.gain.value = 2.6;
    FORMANT_GAIN.forEach((g, i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = i === 0 ? 7 : 11;
      bp.frequency.value = VOWELS[2].f[i];
      const gn = ctx.createGain();
      gn.gain.value = g;
      this.tone.out.connect(bp);
      bp.connect(gn);
      gn.connect(sum);
      this.bands.push(bp);
    });
    sum.connect(this.chain.filter);

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 5.2;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.tone.detuneParams.forEach((d) => this.lfoGain.connect(d));
    this.lfo.start();
    this.tone.setFreq(220, 0.01);
  }

  update(hands: Hand[]): Spawn[] {
    const { ctx } = this.env;
    const opts = this.env.getOpts();
    const cal = this.env.getCal();
    const a = alphaOf(cal, 0.7);
    const p = baseParams(hands);
    const h = hands[0];
    const len = scaleLength(opts.scale);

    if (!h) {
      this.vol.step(0, 0.3);
      setParam(this.chain.gain.gain, 0, ctx, 0.12);
      this.params = p;
      return [];
    }

    const f = h.f;
    const height = this.height.step(f.height, a);
    const degree = Math.round(height * (len * 2 - 1));
    const midi = scaleMidi(opts.scale, opts.root, degree, 48);
    const freq = midiToFreq(midi);
    this.tone.setFreq(freq, 0.05);

    const openness = this.open.step(f.openness, a);
    const pos = clamp01(openness) * (VOWELS.length - 1);
    const i0 = Math.min(VOWELS.length - 2, Math.floor(pos));
    const t = pos - i0;
    for (let i = 0; i < 3; i++) {
      const fr = lerp(VOWELS[i0].f[i], VOWELS[i0 + 1].f[i], t);
      setParam(this.bands[i].frequency, fr, ctx, 0.06);
    }
    const vowel = VOWELS[Math.round(pos)].name;

    const vol = this.vol.step(lerp(0.06, 0.34, f.proximity), a);
    setParam(this.chain.gain.gain, vol, ctx, 0.08);

    const depth = clamp01((Math.abs(f.tilt) - 0.1) * 1.8);
    setParam(this.lfoGain.gain, depth * 45, ctx, 0.1);
    setParam(this.chain.send.gain, 0.5 * (opts.reverb / 50), ctx);
    setParam(this.chain.pan.pan, clamp((f.dx - 0.5) * 0.6, -1, 1), ctx);

    p.freq = freq;
    p.pitchLabel = freqToLabel(freq);
    p.pitch = height;
    p.volume = vol / 0.34;
    p.timbre = openness;
    p.fx = depth;
    p.hint = `Голосна «${vowel}» · нота ${p.pitchLabel}`;
    this.params = p;
    return [];
  }

  stop() {
    this.tone.stop();
    this.chain.dispose();
    try {
      this.lfo.stop();
    } catch {
      // вже зупинено
    }
  }
}

// ============================================================
// 9. Вобл-бас
// ============================================================

class WobbleMode implements ModeVoice {
  params = emptyParams();
  private env: Env;
  private tone: ToneSource;
  private sub: OscillatorNode;
  private subGain: GainNode;
  private chain: Chain;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  private degree = 0;
  private rate = new Smooth(2);
  private lastDegree = -1;

  constructor(env: Env) {
    this.env = env;
    const { ctx } = env;
    this.tone = new ToneSource(ctx, pickWave(env, 'sawtooth'), [-14, 0, 14], null, SAMPLE_BASE);
    this.chain = makeChain(env, 'lowpass', 600);
    this.chain.filter.Q.value = 8;
    this.sub = ctx.createOscillator();
    this.sub.type = 'sine';
    this.subGain = ctx.createGain();
    this.subGain.gain.value = 0.9;
    this.sub.connect(this.subGain);
    const mix = ctx.createGain();
    mix.gain.value = 0.8;
    this.tone.out.connect(mix);
    this.subGain.connect(mix);
    mix.connect(this.chain.filter);
    this.sub.start();

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = 2;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = 0;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.chain.filter.frequency);
    this.lfo.start();
    this.tone.setFreq(55, 0.01);
    this.sub.frequency.value = 55;
  }

  update(hands: Hand[]): Spawn[] {
    const { ctx } = this.env;
    const opts = this.env.getOpts();
    const spawns: Spawn[] = [];
    const p = baseParams(hands);
    const h = hands[0];

    if (!h) {
      setParam(this.chain.gain.gain, 0, ctx, 0.08);
      this.params = p;
      return spawns;
    }

    const f = h.f;
    const gate = f.fingers > 0;
    if (gate) this.degree = f.fingers - 1;

    const midi = scaleMidi(opts.scale, opts.root, this.degree, 33);
    const freq = midiToFreq(midi);
    this.tone.setFreq(freq, 0.02);
    this.sub.frequency.setTargetAtTime(freq, ctx.currentTime, 0.02);

    // швидкість воблу: від 0.6 до 14 Гц (експоненційно, щоб було музично)
    const rate = this.rate.step(0.6 * Math.pow(23, f.dx), 0.25);
    setParam(this.lfo.frequency, rate, ctx, 0.05);

    const base = 160 + f.height * 700;
    const depth = 250 + f.height * 3200;
    setParam(this.chain.filter.frequency, base, ctx, 0.05);
    setParam(this.lfoGain.gain, depth, ctx, 0.08);
    setParam(this.chain.filter.Q, 2 + f.spread * 14, ctx, 0.06);

    setParam(this.chain.gain.gain, gate ? 0.32 : 0, ctx, gate ? 0.02 : 0.07);
    setParam(this.chain.send.gain, 0.1 * (opts.reverb / 50), ctx);
    setParam(this.chain.pan.pan, 0, ctx);

    if (gate && this.degree !== this.lastDegree) {
      this.lastDegree = this.degree;
      spawns.push({ x: f.rawX, y: f.rawY, color: '#4cc9ff', count: 8 });
    }

    p.freq = freq;
    p.pitchLabel = freqToLabel(freq);
    p.pitch = clamp01(this.degree / 4);
    p.volume = gate ? 0.8 : 0;
    p.timbre = f.spread;
    p.fx = clamp01(Math.log(rate / 0.6) / Math.log(23));
    p.hint = gate ? `Нота ${p.pitchLabel} · вобл ${rate.toFixed(1)} Гц` : 'Кулак — пауза. Покажи пальці, щоб дропнути бас';
    this.params = p;
    return spawns;
  }

  stop() {
    this.tone.stop();
    this.chain.dispose();
    try {
      this.sub.stop();
      this.lfo.stop();
    } catch {
      // вже зупинено
    }
  }
}

export function createMode(id: ModeId, env: Env): ModeVoice {
  switch (id) {
    case 'arp':
      return new ArpMode(env);
    case 'choir':
      return new ChoirMode(env);
    case 'wobble':
      return new WobbleMode(env);
    case 'lead':
      return new LeadMode(env);
    case 'pluck':
      return new PluckMode(env);
    case 'percussive':
      return new PercussiveMode(env);
    case 'theremin':
      return new ThereminMode(env);
    case 'chord':
      return new ChordMode(env);
    default:
      return new AmbientMode(env);
  }
}

export { DEFAULT_CALIBRATION };
