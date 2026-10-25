import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { getErrorMessage, getMe, getPresets, getRecordings, updateMe } from '../api';
import type { ApiUser } from '../api';
import type { Calibration } from '../audio/features';
import { fetchCalibration, loadCachedCalibration, persistCalibration } from '../lib/calibration';
import { initials } from '../lib/format';

function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState<ApiUser | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [cal, setCal] = useState<Calibration>(() => loadCachedCalibration());
  const [saved, setSaved] = useState(true);
  const [counts, setCounts] = useState({ presets: 0, takes: 0 });
  const loadedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    getMe()
      .then((u) => {
        setUser(u);
        setName(u.fullName);
      })
      .catch((err) => setError(getErrorMessage(err, 'Не вдалось завантажити профіль')));
    getPresets().then((p) => setCounts((c) => ({ ...c, presets: p.length }))).catch(() => {});
    getRecordings().then((r) => setCounts((c) => ({ ...c, takes: r.length }))).catch(() => {});
    fetchCalibration().then((c) => {
      setCal(c);
      loadedRef.current = true;
    });
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const changeCal = (patch: Partial<Calibration>) => {
    const next = { ...cal, ...patch };
    setCal(next);
    setSaved(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        await persistCalibration(next);
        setSaved(true);
      } catch {
        setError('Не вдалось зберегти налаштування трекінгу');
      }
    }, 600);
  };

  const saveName = async () => {
    setError('');
    setMsg('');
    try {
      const updated = await updateMe(name);
      setUser(updated);
      localStorage.setItem('user', JSON.stringify({ id: updated.id, fullName: updated.fullName, email: updated.email }));
      setEditing(false);
      setMsg('Ім’я оновлено');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('activePreset');
    navigate('/login');
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
    : '—';
  const days = user?.createdAt ? Math.max(1, Math.round((Date.now() - new Date(user.createdAt).getTime()) / 86400000)) : 0;

  const handSizeText = cal.calibrated ? (cal.sizeNear - cal.sizeFar > 0.2 ? 'Відкалібровано · велика' : cal.sizeNear - cal.sizeFar > 0.12 ? 'Відкалібровано · середня' : 'Відкалібровано · мала') : 'Ще не калібровано';
  const gestureText = cal.calibrated ? `Долоня ${cal.palmRatio.toFixed(2)} · кулак ${cal.fistRatio.toFixed(2)}` : 'Типові значення';
  const rangeText = cal.calibrated ? `${cal.sizeFar.toFixed(2)} – ${cal.sizeNear.toFixed(2)} (розмір долоні)` : 'Типовий діапазон';

  return (
    <>
      <PageHeader crumb="Акаунт" title="Особистий кабінет">
        <button className="btn danger" onClick={logout}>
          Вийти
        </button>
      </PageHeader>

      <div className="page-body">
        <div className="profile-grid">
          <div>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="avatar-lg">{initials(user?.fullName)}</div>
              <div className="profile-name">{user?.fullName || '…'}</div>
              <div className="profile-email">{user?.email}</div>
              <button className="btn block" onClick={() => setEditing(true)}>
                Редагувати профіль
              </button>
              <div className="mini-stats">
                <div>
                  <strong>{counts.presets}</strong>
                  <span>Пресетів</span>
                </div>
                <div>
                  <strong>{counts.takes}</strong>
                  <span>Записів</span>
                </div>
                <div>
                  <strong>{days}</strong>
                  <span>Днів з нами</span>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 14 }}>
              <div className="menu">
                <a className="on" href="#account" onClick={(e) => { e.preventDefault(); document.getElementById('account')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  ◇ Дані акаунта
                </a>
                <a href="#tracking" onClick={(e) => { e.preventDefault(); document.getElementById('tracking')?.scrollIntoView({ behavior: 'smooth' }); }}>
                  ≡ Трекінг і калібрування
                </a>
                <Link to="/presets">▤ Збережені пресети</Link>
                <Link to="/recordings">● Записи</Link>
                <Link to="/sounds">♪ Власні звуки</Link>
              </div>
            </div>
          </div>

          <div>
            <div className="card" id="account" style={{ marginBottom: 20 }}>
              <h2 className="card-title">Дані акаунта</h2>
              <div className="form-grid">
                <div>
                  <label className="field" style={{ marginTop: 0 }}>Повне ім’я</label>
                  <input className="input" value={name} readOnly={!editing} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="field" style={{ marginTop: 0 }}>Email</label>
                  <input className="input" value={user?.email || ''} readOnly />
                </div>
                <div>
                  <label className="field">Учасник з</label>
                  <input className="input" value={memberSince} readOnly />
                </div>
                <div>
                  <label className="field">Тариф</label>
                  <input className="input" value="Безкоштовний" readOnly />
                </div>
              </div>
              {editing && (
                <div className="modal-actions">
                  <button className="btn" onClick={() => { setEditing(false); setName(user?.fullName || ''); }}>
                    Скасувати
                  </button>
                  <button className="btn primary" onClick={saveName}>
                    Зберегти
                  </button>
                </div>
              )}
              {msg && <div className="ok-box">{msg}</div>}
              {error && <div className="error-box">{error}</div>}
            </div>

            <div className="card" id="tracking">
              <div className="panel-head">
                <h2 className="card-title" style={{ margin: 0 }}>Чутливість і калібрування трекінгу</h2>
                <span className="mini-tag">{saved ? 'діє в усіх режимах' : 'зберігаємо…'}</span>
              </div>

              <div className="slider-block">
                <div className="slider-head">
                  <span>Чутливість жестів</span>
                  <b>{cal.sensitivity}%</b>
                </div>
                <input type="range" min={0} max={100} value={cal.sensitivity} style={{ ['--fill' as string]: `${cal.sensitivity}%` }} onChange={(e) => changeCal({ sensitivity: Number(e.target.value) })} />
              </div>

              <div className="slider-block">
                <div className="slider-head">
                  <span>Згладжування (менше тремтіння)</span>
                  <b>{cal.smoothing}%</b>
                </div>
                <input type="range" min={0} max={100} value={cal.smoothing} style={{ ['--fill' as string]: `${cal.smoothing}%` }} onChange={(e) => changeCal({ smoothing: Number(e.target.value) })} />
              </div>

              <div className="slider-block">
                <div className="slider-head">
                  <span>Поріг упевненості розпізнавання</span>
                  <b>{cal.confidence}%</b>
                </div>
                <input type="range" min={20} max={95} value={cal.confidence} style={{ ['--fill' as string]: `${((cal.confidence - 20) / 75) * 100}%` }} onChange={(e) => changeCal({ confidence: Number(e.target.value) })} />
              </div>

              <div className="crumb" style={{ margin: '28px 0 6px' }}>Калібрування під твою руку та кімнату</div>
              <div className="calib-tiles">
                <div className="tile">
                  <div className="ico">✋</div>
                  <strong>Розмір руки</strong>
                  <small>{handSizeText}</small>
                </div>
                <div className="tile">
                  <div className="ico">☀</div>
                  <strong>Жести</strong>
                  <small>{gestureText}</small>
                </div>
                <div className="tile">
                  <div className="ico">▣</div>
                  <strong>Діапазон відстані</strong>
                  <small>{rangeText}</small>
                </div>
                <button className="tile action" onClick={() => navigate('/play?calibrate=1')}>
                  <div className="ico">↻</div>
                  <strong>Відкалібрувати</strong>
                  <small style={{ color: 'var(--dim)' }}>Займе ~20 секунд</small>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Profile;
