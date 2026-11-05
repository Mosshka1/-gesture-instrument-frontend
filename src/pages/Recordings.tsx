import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import Skeleton from '../components/Skeleton';
import { IconDownload, IconEdit, IconTrash } from '../components/Icons';
import { deleteRecording, getErrorMessage, getRecordings, renameRecording, uploadUrl } from '../api';
import type { ApiRecording } from '../api';
import { MODES, getModeMeta } from '../audio/modes';
import { formatBytes, formatDuration } from '../lib/format';
import Glyph from '../components/Glyph';

const BARS = 40;

// Псевдо-хвиля: стабільна для кожного запису (залежить лише від id)
function waveHeights(seed: number) {
  const out: number[] = [];
  let s = seed * 9301 + 49297;
  for (let i = 0; i < BARS; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push(18 + (s / 233280) * 82);
  }
  return out;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function Recordings() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ApiRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [renaming, setRenaming] = useState<ApiRecording | null>(null);
  const [newName, setNewName] = useState('');
  const [toDelete, setToDelete] = useState<ApiRecording | null>(null);
  const [busy, setBusy] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getRecordings()
      .then(setItems)
      .catch((err) => setError(getErrorMessage(err, 'Не вдалось завантажити записи')))
      .finally(() => setLoading(false));
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const stats = useMemo(() => {
    const total = items.reduce((sum, r) => sum + (r.durationSec || 0), 0);
    const modes = new Set(items.map((r) => r.mode).filter(Boolean));
    const bytes = items.reduce((sum, r) => sum + (r.sizeBytes || 0), 0);
    return { total, modes: modes.size, bytes };
  }, [items]);

  const togglePlay = (rec: ApiRecording) => {
    if (playingId === rec.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(uploadUrl(rec.fileName));
    // webm з MediaRecorder не має тривалості в заголовку (duration = Infinity),
    // тому беремо тривалість із запису в базі
    const total = () => (audio.duration && isFinite(audio.duration) ? audio.duration : rec.durationSec || 0);
    audio.ontimeupdate = () => {
      const t = total();
      if (t) setProgress(Math.min(1, audio.currentTime / t));
    };
    audio.onended = () => {
      setPlayingId(null);
      setProgress(0);
    };
    audio.onerror = () => {
      setPlayingId(null);
      setError('Не вдалось відтворити запис. Можливо, файл зник із сервера — збережи мелодію ще раз.');
    };
    audio.play().catch(() => {
      setPlayingId(null);
      setError('Не вдалось відтворити запис');
    });
    audioRef.current = audio;
    setProgress(0);
    setPlayingId(rec.id);
  };

  const seek = (rec: ApiRecording, e: React.MouseEvent<HTMLDivElement>) => {
    if (playingId !== rec.id || !audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const a = audioRef.current;
    const t = a.duration && isFinite(a.duration) ? a.duration : rec.durationSec || 0;
    if (t) a.currentTime = ratio * t;
  };

  const downloadRec = async (rec: ApiRecording) => {
    try {
      const res = await fetch(uploadUrl(rec.fileName));
      if (!res.ok) throw new Error('bad');
      const blob = await res.blob();
      const ext = rec.fileName.split('.').pop() || 'webm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${rec.name}.${ext}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Не вдалось завантажити файл');
    }
  };

  const doRename = async () => {
    if (!renaming) return;
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const updated = await renameRecording(renaming.id, newName.trim());
      setItems((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      setRenaming(null);
    } catch (err) {
      setError(getErrorMessage(err));
      setRenaming(null);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      if (playingId === toDelete.id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
      await deleteRecording(toDelete.id);
      setItems((list) => list.filter((r) => r.id !== toDelete.id));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setToDelete(null);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader crumb="Усе, що ти зіграла й зберегла" title="Мої записи">
        <span className="pill">
          <b>{items.length}</b> записів · <b>{formatDuration(stats.total)}</b> разом
        </span>
        <button className="btn primary" onClick={() => navigate('/play')}>
          <Glyph name="play" /> Нова сесія
        </button>
      </PageHeader>

      <div className="page-body">
        <div className="stats">
          <div className="stat">
            <strong>{items.length}</strong>
            <span>Збережених записів</span>
          </div>
          <div className="stat">
            <strong>{formatDuration(stats.total)}</strong>
            <span>Загальна тривалість</span>
          </div>
          <div className="stat">
            <strong>{stats.modes}</strong>
            <span>Використано режимів</span>
          </div>
          <div className="stat">
            <strong>{formatBytes(stats.bytes)}</strong>
            <span>Займає місця</span>
          </div>
        </div>

        {error && <div className="error-box" style={{ marginTop: 0, marginBottom: 16 }}>{error}</div>}

        {loading ? (
          <Skeleton rows={3} />
        ) : items.length === 0 ? (
          <div className="card empty">
            <h3>Записів ще немає</h3>
            <p>На сторінці «Грати» натисни «Записати», пограй і збережи мелодію — вона з’явиться тут.</p>
            <button className="btn primary" style={{ marginTop: 18 }} onClick={() => navigate('/play')}>
              <Glyph name="rec" /> Записати першу мелодію
            </button>
          </div>
        ) : (
          <div className="rec-list">
            {items.map((rec) => {
              const meta = rec.mode && MODES.some((m) => m.id === rec.mode) ? getModeMeta(rec.mode) : null;
              const heights = waveHeights(rec.id);
              const isPlaying = playingId === rec.id;
              return (
                <div key={rec.id} className={'rec-item' + (isPlaying ? ' playing' : '')}>
                  <button className={'play-btn' + (isPlaying ? ' on' : '')} onClick={() => togglePlay(rec)}>
                    <Glyph name={isPlaying ? 'pause' : 'play'} />
                  </button>

                  <div style={{ minWidth: 0 }}>
                    <div className="rec-name">{rec.name}</div>
                    <div className="rec-meta">
                      {formatDate(rec.createdAt)}
                      {rec.sizeBytes ? ` · ${formatBytes(rec.sizeBytes)}` : ''}
                      <span className="rec-meta-compact">
                        {meta ? ` · ${meta.name}` : ''}
                        {rec.durationSec != null ? ` · ${formatDuration(rec.durationSec)}` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="mini-wave" onClick={(e) => seek(rec, e)}>
                    {heights.map((h, i) => (
                      <i key={i} className={isPlaying && i / BARS < progress ? 'on' : ''} style={{ height: `${h}%` }} />
                    ))}
                  </div>

                  <span className="rec-dur">
                    {isPlaying && rec.durationSec ? `${formatDuration(Math.round(progress * rec.durationSec))} / ` : ''}
                    {rec.durationSec != null ? formatDuration(rec.durationSec) : '—'}
                  </span>

                  <span className="rec-tag-cell">
                    {meta && (
                      <span className="tag" style={{ ['--c' as string]: meta.color }}>
                        {meta.name}
                      </span>
                    )}
                  </span>

                  <div className="actions">
                    <button className="icon-btn" title="Завантажити" onClick={() => downloadRec(rec)}>
                      <IconDownload />
                    </button>
                    <button
                      className="icon-btn"
                      title="Перейменувати"
                      onClick={() => {
                        setRenaming(rec);
                        setNewName(rec.name);
                      }}
                    >
                      <IconEdit />
                    </button>
                    <button className="icon-btn danger" title="Видалити" onClick={() => setToDelete(rec)}>
                      <IconTrash />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {renaming && (
        <Modal
          title="Перейменувати запис"
          onClose={() => setRenaming(null)}
          actions={
            <>
              <button className="btn" onClick={() => setRenaming(null)}>
                Скасувати
              </button>
              <button className="btn primary" onClick={doRename} disabled={busy || !newName.trim()}>
                Зберегти
              </button>
            </>
          }
        >
          <label className="field">Нова назва</label>
          <input className="input" value={newName} autoFocus onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doRename()} />
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="Видалити запис?"
          subtitle={`«${toDelete.name}» буде видалено назавжди.`}
          onClose={() => setToDelete(null)}
          actions={
            <>
              <button className="btn" onClick={() => setToDelete(null)}>
                Скасувати
              </button>
              <button className="btn danger" onClick={doDelete} disabled={busy}>
                Видалити
              </button>
            </>
          }
        >
          <span />
        </Modal>
      )}
    </>
  );
}

export default Recordings;
