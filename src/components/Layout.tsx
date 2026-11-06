import { useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { IconHelp, IconModes, IconPlay, IconPresets, IconRecordings, IconSounds } from './Icons';
import Footer from './Footer';
import ThemeToggle from './ThemeToggle';
import { getStoredUser, initials } from '../lib/format';

const LINKS = [
  { to: '/play', k: 'play', label: 'Грати', title: 'Грати', Icon: IconPlay },
  { to: '/modes', k: 'modes', label: 'Режими', title: 'Режими інструмента', Icon: IconModes },
  { to: '/presets', k: 'presets', label: 'Пресети', title: 'Мої пресети', Icon: IconPresets },
  { to: '/recordings', k: 'recordings', label: 'Записи', title: 'Мої записи', Icon: IconRecordings },
  { to: '/sounds', k: 'sounds', label: 'Звуки', title: 'Власні звуки', Icon: IconSounds },
];

function Layout() {
  const user = getStoredUser();
  const { pathname } = useLocation();
  // кожен розділ друкується своєю фарбою (див. [data-section] в riso.css)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const section = pathname.split('/')[1] || 'play';
  const cls = ({ isActive }: { isActive: boolean }) => 'nav-link' + (isActive ? ' active' : '');

  return (
    <div className="app-shell" data-section={section}>
      <header className="masthead">
        <NavLink to="/play" className="wordmark" title="GestureSound">
          <span className="wm-back" aria-hidden="true">Gesture<br />Sound</span>
          <span className="wm-front">Gesture<br />Sound</span>
        </NavLink>

        <nav className="nav-strip" aria-label="Розділи">
          {LINKS.map(({ to, k, label, title, Icon }) => (
            <NavLink key={to} to={to} className={cls} title={title} data-k={k}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="masthead-end">
          <ThemeToggle />
          <NavLink to="/tutorial" className={cls} title="Як грати" data-k="tutorial">
            <IconHelp />
            <span>Навчання</span>
          </NavLink>
          <NavLink to="/profile" title="Профіль" className="side-profile">
            {({ isActive }) => <div className={'avatar-sm' + (isActive ? ' active' : '')}>{initials(user?.fullName)}</div>}
          </NavLink>
        </div>
      </header>

      <main className="main">
        <div className="page-transition" key={pathname}>
          <Outlet />
        </div>
        <Footer />
      </main>
    </div>
  );
}

export default Layout;
