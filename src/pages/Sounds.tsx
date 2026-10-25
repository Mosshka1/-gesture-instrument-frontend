import { useEffect, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { IconTrash } from '../components/Icons';
import { deleteSound, getErrorMessage, getSounds, uploadSound, uploadUrl } from '../api';
import type { ApiSound } from '../api';

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
              <span className="nm">{s.name}</span>
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
