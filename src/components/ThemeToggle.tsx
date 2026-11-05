import { useEffect, useState } from 'react';
import Glyph from './Glyph';

export type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function readTheme(): Theme {
  try {
    const t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* ignore */
  }
  return systemTheme();
}

function ThemeToggle({ floating }: { floating?: boolean }) {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e1030' : '#e9ecf2');
  }, [theme]);

  const flip = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      className={'theme-toggle' + (floating ? ' floating' : '')}
      onClick={flip}
      title={theme === 'dark' ? 'Світла тема' : 'Темна тема'}
      aria-label={theme === 'dark' ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
    >
      <Glyph name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
    </button>
  );
}

export default ThemeToggle;
