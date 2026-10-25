import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getErrorMessage, registerUser } from '../api';
import GoogleButton from '../components/GoogleButton';
import AuthHero from '../components/AuthHero';

function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await registerUser(fullName, email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate(localStorage.getItem('tutorialCompleted') ? '/play' : '/tutorial');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="brand">
            <div className="logo-mark" />
            <div className="brand-name">
              GESTURE<span>SOUND</span>
            </div>
          </div>

          <h1>Створити акаунт</h1>
          <p className="lead">Зберігай власні пресети, записуй мелодії та налаштуй інструмент під свою руку.</p>

          <label className="field">Повне ім’я</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Анна Коваленко" required />

          <label className="field">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@studio.dev" required />

          <label className="field">Пароль</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Придумай пароль" required />

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="btn primary block" style={{ marginTop: 22, padding: 15 }} disabled={loading}>
            {loading ? 'Створюємо…' : 'Зареєструватись →'}
          </button>

          <div className="divider">або продовжити через</div>
          <GoogleButton text="signup_with" onError={setError} />

          <p className="auth-foot">
            Вже є акаунт? <Link to="/login">Увійти</Link>
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
