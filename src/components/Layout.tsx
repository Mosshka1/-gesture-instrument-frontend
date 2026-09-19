import { Outlet, NavLink, useNavigate } from 'react-router-dom';

function Layout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    display: 'block',
    padding: '10px 16px',
    borderRadius: 8,
    textDecoration: 'none',
    color: isActive ? '#fff' : '#444',
    background: isActive ? '#4DC9B0' : 'transparent',
    marginBottom: 6,
  });

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <nav
        style={{
          width: 200,
          background: '#f5f5f5',
          borderRight: '1px solid #ddd',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 20 }}>🎵 Aeris</h3>

        <NavLink to="/play" style={linkStyle}>
          ▶ Грати
        </NavLink>
        <NavLink to="/presets" style={linkStyle}>
          🎛 Пресети
        </NavLink>
        <NavLink to="/recordings" style={linkStyle}>
          🎙 Мої записи
        </NavLink>
        <NavLink to="/tutorial" style={linkStyle}>
          ❓ Як грати
        </NavLink>
        <NavLink to="/profile" style={linkStyle}>
          👤 Профіль
        </NavLink>

        <button
          onClick={handleLogout}
          style={{
            marginTop: 'auto',
            padding: 10,
            background: 'transparent',
            border: '1px solid #ccc',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#c0392b',
          }}
        >
          Вийти
        </button>
      </nav>

      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;