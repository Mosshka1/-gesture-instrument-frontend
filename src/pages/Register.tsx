import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getErrorMessage, registerUser } from '../api';
import GoogleButton from '../components/GoogleButton';
import AuthHero from '../components/AuthHero';
import ThemeToggle from '../components/ThemeToggle';
import { validate } from '../lib/validation';
import type { Fields } from '../lib/validation';

function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<keyof Fields, boolean>>>({});
  const navigate = useNavigate();

  const errs = validate({ fullName, email, password });
  const touch = (k: keyof Fields) => setTouched((t) => ({ ...t, [k]: true }));
  const shown = (k: keyof Fields) => (touched[k] ? errs[k] : undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (Object.keys(errs).length) {
      setTouched({ fullName: true, email: true, password: true });
      return;
    }
    setLoading(true);
    const slowTimer = setTimeout(() => setSlow(true), 4000);
    try {
      const data = await registerUser(fullName.trim(), email.trim().toLowerCase(), password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate(localStorage.getItem('tutorialCompleted') ? '/play' : '/tutorial');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      clearTimeout(slowTimer);
      setSlow(false);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <ThemeToggle floating />
      <div className="auth-left">
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="brand">
            <div className="logo-mark" />
            <div className="brand-name">
              GESTURE<span>SOUND</span>
            </div>
          </div>

          <h1>Створити акаунт</h1>
          <p className="lead">Зберігай власні пресети, записуй мелодії та налаштуй інструмент під свою руку.</p>

          <label className="field">Повне ім’я</label>
          <input className={'input' + (shown('fullName') ? ' invalid' : '')} value={fullName} autoComplete="name" maxLength={60} onChange={(e) => setFullName(e.target.value)} onBlur={() => touch('fullName')} placeholder="Анна Коваленко" aria-invalid={!!shown('fullName')} />
          {shown('fullName') && <div className="field-error">{shown('fullName')}</div>}

          <label className="field">Email</label>
          <input className={'input' + (shown('email') ? ' invalid' : '')} type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} onBlur={() => touch('email')} placeholder="anna@studio.dev" aria-invalid={!!shown('email')} />
          {shown('email') && <div className="field-error">{shown('email')}</div>}

          <label className="field">Пароль</label>
          <input className={'input' + (shown('password') ? ' invalid' : '')} type="password" value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} onBlur={() => touch('password')} placeholder="Придумай пароль" aria-invalid={!!shown('password')} />
          {shown('password') ? <div className="field-error">{shown('password')}</div> : <div className="field-hint">Щонайменше 8 символів, літери й цифри</div>}

          {error && <div className="error-box">{error}</div>}
          {slow && <div className="ok-box">Сервер прокидається після простою — це може тривати до хвилини. Зачекай, будь ласка…</div>}

          <button type="submit" className="btn primary block" style={{ marginTop: 22, padding: 15 }} disabled={loading}>
            {loading ? 'Створюємо…' : 'Створити акаунт'}
          </button>

          <div className="divider">або продовжити через</div>
          <GoogleButton text="signup_with" onError={setError} />

          <p className="auth-foot">
            Вже є акаунт? <Link to="/login">Увійти</Link>
          </p>
          <p className="auth-foot legal-mini">
            Реєструючись, ти погоджуєшся з <Link to="/terms">умовами</Link> та <Link to="/privacy">політикою конфіденційності</Link>
          </p>
        </form>
      </div>
      <div className="auth-right">
        <AuthHero />
      </div>
    </div>
  );
}

export default Register;
