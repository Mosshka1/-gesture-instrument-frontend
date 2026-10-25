import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getErrorMessage, loginUser } from '../api';
import GoogleButton from '../components/GoogleButton';
import AuthHero from '../components/AuthHero';

function Login() {
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
      const data = await loginUser(email, password);
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

          <h1>З поверненням</h1>
          <p className="lead">Увійди, щоб завантажити свої пресети, продовжити збережену мелодію та повернутись до інструмента.</p>

          <label className="field">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="anna@studio.dev" required />

          <label className="field">Пароль</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />

          {error && <div className="error-box">{error}</div>}

          <button type="submit" className="btn primary block" style={{ marginTop: 22, padding: 15 }} disabled={loading}>
            {loading ? 'Входимо…' : 'Увійти →'}
          </button>

          <div className="divider">або продовжити через</div>
          <GoogleButton text="signin_with" onError={setError} />

          <p className="auth-foot">
            Вперше тут? <Link to="/register">Створити акаунт</Link>
          </p>
        </form>
      </div>
      <div className="auth-right">
        <AuthHero />
      </div>
    </div>
  );
}

export default Login;
