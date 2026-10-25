import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { IconTrash } from '../components/Icons';
import { addFreesoundSound, deleteSound, getErrorMessage, getSounds, searchFreesound, uploadSound, uploadUrl } from '../api';
import type { ApiSound, FreesoundResult } from '../api';

type SoundType = 'instrument' | 'background';

function SoundSection({
  type,
  title,
  hint,
  sounds,
  onChanged,
}: {
  type: SoundType;
  title: string;
  hint: string;
  sounds: ApiSound[];
  onChanged: () => void;
}) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const upload = async () => {
    if (!file) {
      setError('Обери аудіофайл');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await uploadSound(name.trim() || file.name.replace(/\.[^.]+$/, ''), type, file);
      setName('');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: ApiSound) => {
    try {
      if (playingId === s.id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
      await deleteSound(s.id);
      // якщо цей звук був вибраний — прибираємо вибір
      if (localStorage.getItem('selectedSoundId') === String(s.id)) localStorage.setItem('selectedSoundId', '');
      if (localStorage.getItem('selectedBackgroundId') === String(s.id)) localStorage.setItem('selectedBackgroundId', '');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const toggle = (s: ApiSound) => {
    audioRef.current?.pause();
    if (playingId === s.id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(uploadUrl(s.fileName));
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setError('Не вдалось відтворити'));
    audioRef.current = audio;
    setPlayingId(s.id);
  };

  return (
    <div className="card">
      <h2 className="card-title">{title}</h2>
      <p className="hint">{hint}</p>

      <label className="field" style={{ marginTop: 0 }}>Назва</label>
      <input className="input" value={name} placeholder="Наприклад: Моя гітара" onChange={(e) => setName(e.target.value)} />

      <label className="field">Аудіофайл (до 10 МБ)</label>
      <input
        ref={inputRef}
        className="input"
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      {error && <div className="error-box">{error}</div>}

      <button className="btn primary block" style={{ marginTop: 16 }} onClick={upload} disabled={busy}>
        {busy ? 'Завантажуємо…' : 'Завантажити'}
      </button>

      <div style={{ marginTop: 22 }}>
        {sounds.length === 0 ? (
          <p className="hint" style={{ marginBottom: 0 }}>Поки що порожньо.</p>
        ) : (
          sounds.map((s) => (
            <div className="sound-item" key={s.id}>
              <button className={'icon-btn' + (playingId === s.id ? ' active' : '')} onClick={() => toggle(s)} title="Прослухати">
                {playingId === s.id ? '❚❚' : '▶'}
              </button>
              <span className="nm">
                {s.name}
                {s.author && (
                  <small className="credit">
                    {' '}· {s.author}{s.license ? `, ${s.license}` : ''}
                  </small>
                )}
              </span>
              <button className="icon-btn danger" onClick={() => remove(s)} title="Видалити">
                <IconTrash />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FreesoundLibrary({ onAdded }: { onAdded: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<FreesoundResult[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searched, setSearched] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const run = async (term: string, pg: number) => {
    if (!term) return;
    setBusy(true);
    setError('');
    try {
      const data = await searchFreesound(term, pg);
      setResults((prev) => (pg === 1 ? data.results : [...prev, ...data.results]));
      setHasMore(data.hasMore);
      setPage(pg);
      setSearched(term);
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалось знайти звуки'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (r: FreesoundResult) => {
    audioRef.current?.pause();
    if (playingId === r.id) {
      setPlayingId(null);
      return;
    }
    const audio = new Audio(r.previewUrl);
    audio.onended = () => setPlayingId(null);
    audio.play().catch(() => setError('Не вдалось відтворити'));
    audioRef.current = audio;
    setPlayingId(r.id);
  };

  const add = async (r: FreesoundResult, type: 'instrument' | 'background') => {
    try {
      await addFreesoundSound(r, type);
      setAddedIds((a) => [...a, r.id]);
      onAdded();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <h2 className="card-title">Бібліотека Freesound</h2>
      <p className="hint">
        Шукай звуки (англійською працює найкраще: «piano», «kick», «guitar», «lofi loop») і додавай їх до себе. Показуємо лише вільні
        ліцензії CC0 та CC-BY, автор зберігається поруч зі звуком.
      </p>
      <form
        className="fs-search"
        onSubmit={(e) => {
          e.preventDefault();
          run(q.trim(), 1);
        }}
      >
        <input className="input" value={q} placeholder="Що шукаємо?" onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" type="submit" disabled={busy || !q.trim()}>
          {busy && page === 1 ? 'Шукаємо…' : 'Знайти'}
        </button>
      </form>

      {error && <div className="error-box">{error}</div>}

      {searched && !busy && results.length === 0 && !error && <p className="hint" style={{ marginTop: 16 }}>Нічого не знайшли за «{searched}».</p>}

      <div style={{ marginTop: results.length ? 16 : 0 }}>
        {results.map((r) => (
          <div className="sound-item fs-item" key={r.id}>
            <button className={'icon-btn' + (playingId === r.id ? ' active' : '')} onClick={() => toggle(r)} title="Прослухати">
              {playingId === r.id ? '❚❚' : '▶'}
            </button>
            <span className="nm">
              {r.name}
              <small className="credit">
                {' '}· {r.duration.toFixed(1)} с · {r.author} · {r.license === 'Creative Commons 0' ? 'CC0' : 'CC-BY'}
              </small>
            </span>
            {addedIds.includes(r.id) ? (
              <span className="pill">додано</span>
            ) : (
              <>
                <button className="btn sm" onClick={() => add(r, 'instrument')} title="Додати як звук інструмента">
                  + інструмент
                </button>
                <button className="btn sm" onClick={() => add(r, 'background')} title="Додати як фонову петлю">
                  + фон
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {hasMore && (
        <button className="btn block" style={{ marginTop: 12 }} onClick={() => run(searched, page + 1)} disabled={busy}>
          {busy ? 'Завантажуємо…' : 'Показати ще'}
        </button>
      )}
    </div>
  );
}

function Sounds() {
  const [sounds, setSounds] = useState<ApiSound[]>([]);
  const [error, setError] = useState('');

  const load = () => {
    getSounds()
      .then(setSounds)
      .catch((err) => setError(getErrorMessage(err, 'Не вдалось завантажити звуки')));
  };

  useEffect(load, []);

  return (
    <>
      <PageHeader crumb="Бібліотека / Звуки" title="Власні звуки">
        <span className="pill">
          <b>{sounds.length}</b> файлів
        </span>
      </PageHeader>

      <div className="page-body">
        {error && <div className="error-box" style={{ marginTop: 0, marginBottom: 16 }}>{error}</div>}
        <FreesoundLibrary onAdded={load} />
        <div className="two-col">
          <SoundSection
            type="instrument"
            title="Звук інструмента"
            hint="Короткий звук (нота гітари, піаніно, голос…). Інструмент змінюватиме його висоту залежно від руки, а в режимі «Перкусія» розкладе на зони. Вибрати його можна в налаштуваннях на сторінці «Грати»."
            sounds={sounds.filter((s) => s.type === 'instrument')}
            onChanged={load}
          />
          <SoundSection
            type="background"
            title="Фонова петля"
            hint="Довша доріжка (бит, ембіент), яка грає по колу під час сесії й потрапляє в запис. Вибирається там само — в налаштуваннях сесії."
            sounds={sounds.filter((s) => s.type === 'background')}
            onChanged={load}
          />
        </div>
      </div>
    </>
  );
}

export default Sounds;
