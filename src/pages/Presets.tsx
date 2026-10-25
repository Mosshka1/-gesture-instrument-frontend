import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import { IconEdit, IconTrash } from '../components/Icons';
import { createPreset, deletePreset, getErrorMessage, getPresets, markPresetUsed, updatePreset } from '../api';
import type { ApiPreset } from '../api';
import { DEFAULT_OPTS, MODES, getModeMeta, normalizeModeId } from '../audio/modes';
import type { ModeId } from '../audio/modes';
import { NOTE_NAMES, SCALES } from '../audio/music';
import type { ScaleId } from '../audio/music';
import { timeAgo } from '../lib/format';

type SortKey = 'recent' | 'name' | 'used' | 'favorite';

type EditorState = {
  id: number | null;
  name: string;
  mode: ModeId;
  scale: ScaleId;
  root: number;
  reverb: number;
};

function describe(p: ApiPreset) {
  const s = p.settings || {};
  const meta = getModeMeta(normalizeModeId(p.soundType));
  const scale = s.scale && SCALES[s.scale as ScaleId] ? SCALES[s.scale as ScaleId].name : null;
  const root = typeof s.root === 'number' ? NOTE_NAMES[s.root] : null;
  return [meta.name, scale && root ? `${root} ${scale.toLowerCase()}` : null].filter(Boolean).join(' · ');
}

function Presets() {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<ApiPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [modeFilter, setModeFilter] = useState<'all' | ModeId>('all');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState('');
  const [toDelete, setToDelete] = useState<ApiPreset | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setPresets(await getPresets());
    } catch (err) {
      setError(getErrorMessage(err, 'Не вдалось завантажити пресети'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    let list = presets.filter((p) => {
      if (modeFilter !== 'all' && normalizeModeId(p.soundType) !== modeFilter) return false;
      if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
    list = [...list];
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    else if (sort === 'used') list.sort((a, b) => b.usedCount - a.usedCount);
    else if (sort === 'favorite') list.sort((a, b) => Number(b.favorite) - Number(a.favorite) || +new Date(b.updatedAt) - +new Date(a.updatedAt));
    else list.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return list;
  }, [presets, search, sort, modeFilter]);

  const play = async (p: ApiPreset) => {
    localStorage.setItem('activePreset', JSON.stringify(p));
    markPresetUsed(p.id).catch(() => {});
    navigate('/play');
  };

  const toggleFavorite = async (p: ApiPreset) => {
    try {
      const updated = await updatePreset(p.id, { favorite: !p.favorite });
      setPresets((list) => list.map((x) => (x.id === p.id ? updated : x)));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const openCreate = () => {
    setEditorError('');
    setEditor({ id: null, name: '', mode: 'ambient', scale: DEFAULT_OPTS.scale, root: DEFAULT_OPTS.root, reverb: DEFAULT_OPTS.reverb });
  };

  const openEdit = (p: ApiPreset) => {
    const s = p.settings || {};
    setEditorError('');
    setEditor({
      id: p.id,
      name: p.name,
      mode: normalizeModeId(p.soundType),
      scale: s.scale && SCALES[s.scale as ScaleId] ? (s.scale as ScaleId) : DEFAULT_OPTS.scale,
      root: typeof s.root === 'number' ? s.root : DEFAULT_OPTS.root,
      reverb: typeof s.reverb === 'number' ? s.reverb : DEFAULT_OPTS.reverb,
    });
  };

  const saveEditor = async () => {
    if (!editor) return;
    if (!editor.name.trim()) {
      setEditorError('Дай пресету назву');
      return;
    }
    setBusy(true);
    setEditorError('');
    try {
      if (editor.id === null) {
        const created = await createPreset(editor.name.trim(), editor.mode, {
          mode: editor.mode,
          scale: editor.scale,
          root: editor.root,
          reverb: editor.reverb,
        });
        setPresets((list) => [created, ...list]);
      } else {
        const old = presets.find((p) => p.id === editor.id);
        const updated = await updatePreset(editor.id, {
          name: editor.name.trim(),
          soundType: editor.mode,
          settings: { ...(old?.settings || {}), mode: editor.mode, scale: editor.scale, root: editor.root, reverb: editor.reverb },
        });
        setPresets((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      }
      setEditor(null);
    } catch (err) {
      setEditorError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deletePreset(toDelete.id);
      setPresets((list) => list.filter((p) => p.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(getErrorMessage(err));
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader crumb="Бібліотека / Пресети" title="Мої пресети">
        <span className="pill">
          <b>{presets.length}</b> збережено
        </span>
        <button className="btn primary" onClick={openCreate}>
          + Новий пресет
        </button>
      </PageHeader>

      <div className="page-body">
        <div className="toolbar">
          <input className="input search" placeholder="Пошук пресетів…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select className="select compact" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="recent">Сортування: нещодавні</option>
              <option value="name">Сортування: за назвою</option>
              <option value="used">Сортування: найчастіше</option>
              <option value="favorite">Сортування: улюблені</option>
            </select>
            <select className="select compact" value={modeFilter} onChange={(e) => setModeFilter(e.target.value as 'all' | ModeId)}>
              <option value="all">Фільтр: усі режими</option>
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div className="error-box" style={{ marginTop: 0, marginBottom: 16 }}>{error}</div>}

        <div className="table-card">
          {loading ? (
            <div className="empty">Завантажуємо…</div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <h3>{presets.length === 0 ? 'Пресетів ще немає' : 'Нічого не знайдено'}</h3>
              <p>
                {presets.length === 0
                  ? 'Налаштуй звук на сторінці «Грати» і натисни «Зберегти пресет» — або створи його тут.'
                  : 'Спробуй змінити пошук чи фільтр.'}
              </p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Пресет</th>
                  <th>Режим</th>
                  <th>Чутливість</th>
                  <th>Оновлено</th>
                  <th>Використано</th>
                  <th style={{ textAlign: 'right' }}>Дії</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const meta = getModeMeta(normalizeModeId(p.soundType));
                  const sens = p.settings?.sensitivity;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="cell-preset" style={{ ['--c' as string]: meta.color }}>
                          <div className="preset-swatch" />
                          <div>
                            <div className="preset-name">
                              {p.favorite && <span className="star">★</span>}
                              {p.name}
                            </div>
                            <div className="preset-sub">{describe(p)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="tag" style={{ ['--c' as string]: meta.color }}>
                          {meta.name}
                        </span>
                      </td>
                      <td className="mono">{typeof sens === 'number' ? `${sens}%` : '—'}</td>
                      <td style={{ color: 'var(--muted)' }}>{timeAgo(p.updatedAt)}</td>
                      <td className="mono" style={{ color: 'var(--muted)' }}>
                        {p.usedCount}×
                      </td>
                      <td>
                        <div className="actions">
                          <button className={'icon-btn' + (p.favorite ? ' active' : '')} title="В улюблені" onClick={() => toggleFavorite(p)}>
                            {p.favorite ? '★' : '☆'}
                          </button>
                          <button className="icon-btn" title="Грати з цим пресетом" onClick={() => play(p)}>
                            ▶
                          </button>
                          <button className="icon-btn" title="Редагувати" onClick={() => openEdit(p)}>
                            <IconEdit />
                          </button>
                          <button className="icon-btn danger" title="Видалити" onClick={() => setToDelete(p)}>
                            <IconTrash />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editor && (
        <Modal
          title={editor.id === null ? 'Новий пресет' : 'Редагувати пресет'}
          subtitle="Решта налаштувань (звуки, чутливість) зберігаються зі сторінки «Грати»."
          onClose={() => setEditor(null)}
          actions={
            <>
              <button className="btn" onClick={() => setEditor(null)}>
                Скасувати
              </button>
              <button className="btn primary" onClick={saveEditor} disabled={busy}>
                {busy ? 'Зберігаємо…' : 'Зберегти'}
              </button>
            </>
          }
        >
          <label className="field">Назва</label>
          <input className="input" value={editor.name} autoFocus onChange={(e) => setEditor({ ...editor, name: e.target.value })} />

          <label className="field">Режим</label>
          <select className="select" value={editor.mode} onChange={(e) => setEditor({ ...editor, mode: e.target.value as ModeId })}>
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <div className="form-grid">
            <div>
              <label className="field">Гама</label>
              <select className="select" value={editor.scale} onChange={(e) => setEditor({ ...editor, scale: e.target.value as ScaleId })}>
                {Object.entries(SCALES).map(([id, s]) => (
                  <option key={id} value={id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field">Тональність</label>
              <select className="select" value={editor.root} onChange={(e) => setEditor({ ...editor, root: Number(e.target.value) })}>
                {NOTE_NAMES.map((n, i) => (
                  <option key={n} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="field">Реверб: {editor.reverb}%</label>
          <input
            type="range"
            min={0}
            max={100}
            value={editor.reverb}
            style={{ ['--fill' as string]: `${editor.reverb}%` }}
            onChange={(e) => setEditor({ ...editor, reverb: Number(e.target.value) })}
          />

          {editorError && <div className="error-box">{editorError}</div>}
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="Видалити пресет?"
          subtitle={`«${toDelete.name}» буде видалено назавжди.`}
          onClose={() => setToDelete(null)}
          actions={
            <>
              <button className="btn" onClick={() => setToDelete(null)}>
                Скасувати
              </button>
              <button className="btn danger" onClick={confirmDelete} disabled={busy}>
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

export default Presets;
