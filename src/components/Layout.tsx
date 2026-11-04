import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { IconHelp, IconModes, IconPlay, IconPresets, IconRecordings, IconSounds } from './Icons';
import { getStoredUser, initials } from '../lib/format';

function Layout() {
  const user = getStoredUser();
  const { pathname } = useLocation();
  // кожен розділ має свій акцентний колір (див. [data-section] в index.css)
  const section = pathname.split('/')[1] || 'play';
  const cls = ({ isActive }: { isActive: boolean }) => 'side-link' + (isActive ? ' active' : '');

  return (
    <div className="app-shell" data-section={section}>
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

        <NavLink to="/tutorial" className={(s) => cls(s) + ' side-help'} title="Як грати">
          <IconHelp />
          Навчання
        </NavLink>
        <NavLink to="/profile" title="Профіль" className="side-profile">
          {({ isActive }) => <div className={'avatar-sm' + (isActive ? ' active' : '')}>{initials(user?.fullName)}</div>}
        </NavLink>
      </nav>

      <main className="main">
        <div className="page-transition" key={pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default Layout;
