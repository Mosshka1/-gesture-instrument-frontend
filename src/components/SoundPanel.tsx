import { NOTE_NAMES, SCALES } from '../audio/music';
import type { ScaleId } from '../audio/music';
import { DEFAULT_OPTS } from '../audio/modes';
import type { Opts, WaveChoice } from '../audio/modes';
import type { ApiSound } from '../api';

const WAVES: { id: WaveChoice; label: string; hint: string }[] = [
  { id: 'auto', label: 'Авто', hint: 'Кожен режим звучить так, як задумано' },
  { id: 'sine', label: 'М’який', hint: 'Чистий синус — як флейта чи свист' },
  { id: 'triangle', label: 'Теплий', hint: 'Трикутник — округлий, оксамитовий' },
  { id: 'sawtooth', label: 'Яскравий', hint: 'Пила — насичений, «струнний» звук' },
  { id: 'square', label: 'Різкий', hint: 'Квадрат — ретро-відеогра, «дерев’яний»' },
];

type SliderKey = 'reverb' | 'echo' | 'tone' | 'volume';
const SLIDERS: { key: SliderKey; icon: string; label: string; low: string; high: string }[] = [
  { key: 'reverb', icon: '🏛', label: 'Реверб', low: 'сухо', high: 'собор' },
  { key: 'echo', icon: '〰', label: 'Ехо', low: 'немає', high: 'довга луна' },
  { key: 'tone', icon: '☀', label: 'Яскравість', low: 'глухо', high: 'дзвінко' },
  { key: 'volume', icon: '🔊', label: 'Гучність', low: 'тихо', high: 'гучно' },
];

type Props = {
  opts: Opts;
  onChange: (patch: Partial<Opts>) => void;
  soundId: string;
  backgroundId: string;
  onSound: (id: string) => void;
  onBackground: (id: string) => void;
  instrumentSounds: ApiSound[];
  backgroundSounds: ApiSound[];
  hasSounds: boolean;
};

// Усі налаштування звуку: музична основа, характер, ефекти та власні звуки
function SoundPanel({ opts, onChange, soundId, backgroundId, onSound, onBackground, instrumentSounds, backgroundSounds, hasSounds }: Props) {
  const wave = WAVES.find((w) => w.id === opts.wave) || WAVES[0];
  const changed = (['reverb', 'echo', 'tone', 'volume', 'wave'] as (keyof Opts)[]).some((k) => opts[k] !== DEFAULT_OPTS[k]);

  return (
    <div className="sound-panel">
      <div className="sp-block">
        <div className="sp-title">Музична основа</div>
        <label className="field">Гама</label>
        <div className="seg wrap">
          {(Object.entries(SCALES) as [ScaleId, { name: string }][]).map(([id, s]) => (
            <button key={id} className={'seg-btn' + (opts.scale === id ? ' active' : '')} onClick={() => onChange({ scale: id })}>
              {s.name}
            </button>
          ))}
        </div>
        <label className="field">Тональність</label>
        <div className="note-grid">
          {NOTE_NAMES.map((n, i) => (
            <button key={n} className={'note-btn' + (opts.root === i ? ' active' : '')} onClick={() => onChange({ root: i })}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="sp-block">
        <div className="sp-title">Характер звуку</div>
        <div className="seg wrap">
          {WAVES.map((w) => (
            <button key={w.id} className={'seg-btn' + (opts.wave === w.id ? ' active' : '')} onClick={() => onChange({ wave: w.id })}>
              {w.label}
            </button>
          ))}
        </div>
        <p className="hint sp-hint">{wave.hint}</p>
      </div>

      <div className="sp-block">
        <div className="sp-title">Ефекти</div>
        {SLIDERS.map((s) => (
          <div className="fx-row" key={s.key}>
            <div className="fx-head">
              <span>
                <i>{s.icon}</i> {s.label}
              </span>
              <b>{opts[s.key]}%</b>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={opts[s.key]}
              aria-label={s.label}
              style={{ ['--fill' as string]: `${opts[s.key]}%` }}
              onChange={(e) => onChange({ [s.key]: Number(e.target.value) } as Partial<Opts>)}
            />
            <div className="fx-scale">
              <span>{s.low}</span>
              <span>{s.high}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="sp-block">
        <div className="sp-title">Власні звуки</div>
        <label className="field">Звук інструмента</label>
        <select className="select" value={soundId} onChange={(e) => onSound(e.target.value)}>
          <option value="">Стандартний синтез</option>
          {instrumentSounds.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="field">Фонова петля</label>
        <select className="select" value={backgroundId} onChange={(e) => onBackground(e.target.value)}>
          <option value="">Без фону</option>
          {backgroundSounds.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {!hasSounds && <p className="hint sp-hint">Власні звуки можна завантажити в розділі «Звуки».</p>}
      </div>

      <button className="btn block" onClick={() => onChange({ ...DEFAULT_OPTS, scale: opts.scale, root: opts.root })} disabled={!changed}>
        ↺ Скинути ефекти й характер
      </button>
    </div>
  );
}

export default SoundPanel;
