import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { MODES, normalizeModeId } from '../audio/modes';
import type { ModeCategory, ModeId } from '../audio/modes';

const FILTERS: { id: 'all' | ModeCategory; label: string }[] = [
  { id: 'all', label: 'Усі' },
  { id: 'melodic', label: 'Мелодичні' },
  { id: 'chords', label: 'Акорди' },
  { id: 'percussive', label: 'Перкусійні' },
];

function Modes() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | ModeCategory>('all');
  const [selected, setSelected] = useState<ModeId>(() => normalizeModeId(localStorage.getItem('selectedMode')));

  const choose = (id: ModeId) => {
    localStorage.setItem('selectedMode', id);
    localStorage.removeItem('activePreset');
    setSelected(id);
  };

  const list = MODES.filter((m) => filter === 'all' || m.category === filter);

  return (
    <>
      <PageHeader crumb="Інструмент / Режими" title="Вибери режим інструмента">
        <button className="btn primary" onClick={() => navigate('/play')}>
          До сесії →
        </button>
      </PageHeader>

      <div className="page-body">
        <div className="modes-intro">
          <p>
            Кожен режим по-різному перетворює положення руки та жести на звук і має свій тембровий рушій. Режим можна змінити будь-коли просто під
            час гри — на сторінці «Грати» є швидкий перемикач.
          </p>
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.id} className={'chip' + (filter === f.id ? ' active' : '')} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mode-grid">
          {list.map((m) => {
            const isSel = m.id === selected;
            return (
              <div key={m.id} className={'mode-card' + (isSel ? ' selected' : '')} style={{ ['--c' as string]: m.color }}>
                {isSel && (
                  <span className="mini-tag selected-badge" style={{ ['--c' as string]: m.color }}>
                    ● вибрано
                  </span>
                )}
                <div className="mode-icon">{m.icon}</div>
                <h3>{m.name}</h3>
                <p className="desc">{m.desc}</p>
                <div className="mappings">
                  {m.mappings.map(([from, to]) => (
                    <div className="mapping" key={from}>
                      <span>{from}</span>
                      <span>{to}</span>
                    </div>
                  ))}
                </div>
                {isSel ? (
                  <button className="btn primary block" onClick={() => navigate('/play')}>
                    ✓ Активний режим — грати
                  </button>
                ) : (
                  <button className="btn block" onClick={() => choose(m.id)}>
                    Обрати режим
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default Modes;
