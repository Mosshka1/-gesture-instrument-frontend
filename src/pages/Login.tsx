import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../api';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await loginUser(email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/instrument');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Щось пішло не так');
    }
  };

  return (
    <div style={styles.wrapper}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h1>З поверненням</h1>

        {error && <p style={styles.error}>{error}</p>}

        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          required
        />

        <label style={styles.label}>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          required
        />

        <button type="submit" style={styles.button}>
          Увійти
        </button>

        <button type="button" style={styles.googleButton} onClick={() => alert('Google-вхід буде додано пізніше')}>
          Увійти через Google
        </button>

        <p style={{ textAlign: 'center', marginTop: 16 }}>
          Немає акаунту? <Link to="/register">Зареєструватись</Link>
        </p>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontFamily: 'sans-serif' },
  form: { width: 320, display: 'flex', flexDirection: 'column' },
  label: { fontSize: 12, color: '#666', marginTop: 12, marginBottom: 4 },
  input: { padding: 10, borderRadius: 6, border: '1px solid #ccc', fontSize: 14 },
  button: { marginTop: 20, padding: 12, background: '#4DC9B0', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  googleButton: { marginTop: 10, padding: 12, background: '#fff', color: '#333', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  error: { color: 'red', fontSize: 13 },
};

export default Login;