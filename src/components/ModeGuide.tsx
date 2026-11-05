import { MODES, getModeMeta } from '../audio/modes';
import type { ModeId } from '../audio/modes';

// Вибір режиму + покрокова інструкція «що робити рукою → що буде зі звуком»
function ModeGuide({ modeId, onChange, onAll }: { modeId: ModeId; onChange: (id: ModeId) => void; onAll: () => void }) {
  const meta = getModeMeta(modeId);

  return (
    <div className="panel mode-guide" style={{ ['--c' as string]: meta.color }}>
      <div className="panel-head">
        <h3>Режим гри</h3>
        <button className="link-btn mono" onClick={onAll}>
          Усі режими →
        </button>
      </div>

      <div className="mode-tiles">
        {MODES.map((m, i) => (
          <button
            key={m.id}
            className={'mode-tile' + (m.id === modeId ? ' active' : '')}
            style={{ ['--c' as string]: m.color }}
            onClick={() => onChange(m.id)}
            title={m.tagline}
            aria-pressed={m.id === modeId}
          >
            <span className="mt-key" aria-hidden="true">
              {i + 1}
            </span>
            <span className="mt-icon">{m.icon}</span>
            <span className="mt-name">{m.name}</span>
          </button>
        ))}
      </div>

      <p className="hint key-hint">
        Гарячі клавіші: <kbd>1</kbd>–<kbd>9</kbd> — режими, <kbd>R</kbd> — запис
      </p>

      <div className="guide" key={modeId}>
        <div className="guide-title">
          <strong>{meta.name}</strong>
          <span>{meta.tagline}</span>
        </div>
        <ol className="howto">
          {meta.howTo.map((s, i) => (
            <li key={i}>
              <span className="ht-icon">{s.icon}</span>
              <span className="ht-text">
                <b>{s.gesture}</b>
                <em>{s.effect}</em>
              </span>
            </li>
          ))}
        </ol>
        <div className="guide-tip">
          <span>💡</span>
          <p>{meta.tip}</p>
        </div>
      </div>
    </div>
  );
}

export default ModeGuide;
