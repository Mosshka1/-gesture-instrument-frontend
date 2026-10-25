import { Outlet, NavLink } from 'react-router-dom';
import { IconHelp, IconModes, IconPlay, IconPresets, IconRecordings, IconSounds } from './Icons';
import { getStoredUser, initials } from '../lib/format';

function Layout() {
  const user = getStoredUser();
  const cls = ({ isActive }: { isActive: boolean }) => 'side-link' + (isActive ? ' active' : '');

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="logo-mark" title="GestureSound" />

        <NavLink to="/play" className={cls} title="Грати">
          <IconPlay />
          Грати
        </NavLink>
        <NavLink to="/modes" className={cls} title="Режими інструмента">
          <IconModes />
          Режими
        </NavLink>
        <NavLink to="/presets" className={cls} title="Мої пресети">
          <IconPresets />
          Пресети
        </NavLink>
        <NavLink to="/recordings" className={cls} title="Мої записи">
          <IconRecordings />
          Записи
        </NavLink>
        <NavLink to="/sounds" className={cls} title="Власні звуки">
          <IconSounds />
          Звуки
        </NavLink>

        <div className="side-spacer" />

        <NavLink to="/tutorial" className={cls} title="Як грати">
          <IconHelp />
          Туторіал
        </NavLink>
        <NavLink to="/profile" title="Профіль" style={{ marginTop: 8 }}>
          {({ isActive }) => <div className={'avatar-sm' + (isActive ? ' active' : '')}>{initials(user?.fullName)}</div>}
        </NavLink>
      </nav>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
