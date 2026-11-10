import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSharedRecording, uploadUrl } from '../api';
import type { SharedRecording as Shared } from '../api';
import { MODES, getModeMeta } from '../audio/modes';
import { formatDuration } from '../lib/format';
import ThemeToggle from '../components/ThemeToggle';

// Публічна сторінка: послухати запис за посиланням, без входу в акаунт
function SharedRecording() {
  const { token = '' } = useParams();
  const [rec, setRec] = useState<Shared | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'gone' | 'error'>('loading');
  const logged = !!localStorage.getItem('token');

  useEffect(() => {
    let cancelled = false;
    getSharedRecording(token)
      .then((r) => {
        if (cancelled) return;
        setRec(r);
        setState('ok');
      })
      .catch((err) => {
        if (cancelled) return;
        setState(err?.response?.status === 404 ? 'gone' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const meta = rec?.mode && MODES.some((m) => m.id === rec.mode) ? getModeMeta(rec.mode) : null;

  return (
    <div className="legal-page">
      <ThemeToggle floating />
      <article className="legal share-card">
        <Link className="legal-back" to={logged ? '/play' : '/login'}>GestureSound</Link>

        {state === 'loading' && <p>Завантажуємо запис… Якщо сервер спав, це може тривати до хвилини.</p>}

        {state === 'gone' && (
          <>
            <h1>Посилання більше не діє</h1>
            <p>Автор закрив доступ до цього запису або видалив його.</p>
          </>
        )}

        {state === 'error' && (
          <>
            <h1>Не вдалось відкрити запис</h1>
            <p>Перевір інтернет і спробуй оновити сторінку.</p>
            <button className="btn" onClick={() => window.location.reload()}>Оновити</button>
          </>
        )}

        {state === 'ok' && rec && (
          <>
            <h1>{rec.name}</h1>
            <p className="legal-date">
              {rec.author ? `Автор: ${rec.author}` : 'Мелодія з GestureSound'}
              {meta ? ` · режим «${meta.name}»` : ''}
              {rec.durationSec != null ? ` · ${formatDuration(rec.durationSec)}` : ''}
            </p>
            <audio className="rec-preview" src={uploadUrl(rec.fileName)} controls preload="metadata" style={{ width: '100%' }} />
            <h2>Це зіграно рукою в повітрі</h2>
            <p>
              GestureSound перетворює рух руки перед камерою на музику. Нічого встановлювати не треба: достатньо браузера й камери.
            </p>
            <p>
              <Link className="btn primary" to={logged ? '/play' : '/register'}>
                {logged ? 'Грати' : 'Спробувати самому'}
              </Link>
            </p>
          </>
        )}

        <p className="legal-links">
          <Link to="/privacy">Політика конфіденційності</Link> · <Link to="/terms">Умови користування</Link>
        </p>
      </article>
    </div>
  );
}

export default SharedRecording;
