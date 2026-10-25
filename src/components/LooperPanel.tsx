import { useEffect, useState } from 'react';
import type { Looper } from '../audio/looper';
import { MAX_LAYERS } from '../audio/looper';

function LooperPanel({ looper, modeName, version }: { looper: Looper | null; modeName: string; version: number }) {
  const [pos, setPos] = useState(0);

  useEffect(() => {
    if (!looper) return;
    const t = setInterval(() => setPos(looper.position), 60);
    return () => clearInterval(t);
  }, [looper]);

  if (!looper) {
    return (
      <div className="panel">
        <div className="panel-head">
          <h3>Лупер</h3>
          <span className="mini-tag">шари</span>
        </div>
        <p className="hint" style={{ margin: 0 }}>Натисни «Увімкнути звук», щоб користуватись лупером.</p>
      </div>
    );
  }

  void version; // перерендер при змінах у looper
  const { phase, layerList, duration, countdown } = looper;
  const layerName = `${layerList.length + 1}. ${modeName}`;

  let status = 'Запиши основу (біт або мелодію), а потім додавай шари поверх.';
  if (phase === 'countin') status = `Приготуйся… ${countdown}`;
  else if (phase === 'recBase') status = 'Іде запис основи. Натисни «Стоп», коли коло завершено.';
  else if (phase === 'armed') status = 'Чекаємо початок нового кола…';
  else if (phase === 'recLayer') status = 'Записуємо шар. Грай — він сам зупиниться наприкінці кола.';
  else if (phase === 'playing') status = `Коло ${duration.toFixed(1)} с. Можна додати шар зверху або змінити режим і записати інший звук.`;

  return (
    <div className="panel looper">
      <div className="panel-head">
        <h3>Лупер</h3>
        <span className="mini-tag">{layerList.length} / {MAX_LAYERS}</span>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>{status}</p>

      {duration > 0 && (
        <div className="loop-bar">
          <div className="loop-fill" style={{ width: `${pos * 100}%` }} />
        </div>
      )}

      <div className="loop-actions">
        {phase === 'idle' && (
          <button className="btn primary block" onClick={() => looper.startBase(layerName)}>● Записати основу</button>
        )}
        {(phase === 'countin' || phase === 'recBase') && (
          <button className="btn rec block" onClick={() => looper.stopBase()}>■ Стоп</button>
        )}
        {phase === 'playing' && (
          <>
            <button className="btn primary" disabled={layerList.length >= MAX_LAYERS} onClick={() => looper.addLayer(layerName)}>
              + Додати шар
            </button>
            <button className="btn" onClick={() => looper.clear()}>Очистити</button>
          </>
        )}
        {(phase === 'armed' || phase === 'recLayer') && (
          <button className="btn block" onClick={() => looper.cancelLayer()}>Скасувати шар</button>
        )}
      </div>

      {layerList.map((l) => (
        <div className="sound-item" key={l.id}>
          <button className={'icon-btn' + (l.muted ? '' : ' active')} onClick={() => looper.toggleMute(l.id)} title={l.muted ? 'Увімкнути' : 'Вимкнути'}>
            {l.muted ? '🔇' : '🔊'}
          </button>
          <span className="nm" style={{ opacity: l.muted ? 0.45 : 1 }}>{l.name}</span>
          <button className="icon-btn danger" onClick={() => looper.removeLayer(l.id)} title="Видалити шар">✕</button>
        </div>
      ))}
    </div>
  );
}

export default LooperPanel;
