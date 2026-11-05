import type { ReactNode } from 'react';

// Єдиний набір ліній-іконок (замість емодзі й символів). Колір — currentColor.
const P: Record<string, ReactNode> = {
  // жести
  updown: <><path d="M12 4v16" /><path d="M7 9l5-5 5 5" /><path d="M7 15l5 5 5-5" /></>,
  leftright: <><path d="M4 12h16" /><path d="M9 7l-5 5 5 5" /><path d="M15 7l5 5-5 5" /></>,
  depth: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M9 15l6-6" /><path d="M10 9h5v5" /></>,
  spread: <><path d="M12 20v-6" /><path d="M12 14L6 6" /><path d="M12 14l-2-10" /><path d="M12 14l2-10" /><path d="M12 14l6-8" /></>,
  finger: <><path d="M10 11V5a2 2 0 014 0v6" /><path d="M14 11l4 1a2 2 0 011.6 2.3L19 19a2 2 0 01-2 1.6H11a2 2 0 01-1.6-.8L6 15" /></>,
  fist: <><rect x="6" y="9" width="12" height="10" rx="3" /><path d="M9 9V7M12 9V6M15 9V7" /></>,
  hold: <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>,
  bolt: <path d="M13 3L5 13h6l-1 8 8-10h-6z" />,
  drum: <><ellipse cx="12" cy="8" rx="8" ry="3" /><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8" /></>,
  hands: <><path d="M7 20v-7M4 15v-4a1.5 1.5 0 013 0v2" /><path d="M17 20v-7M20 15v-4a1.5 1.5 0 00-3 0v2" /></>,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" /></>,
  // режими
  pad: <><path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0" /></>,
  saw: <><path d="M3 18L10 6v12l7-12v12" /><path d="M17 18h4" /></>,
  string: <><path d="M5 3v18M12 3v18M19 3v18" /><path d="M3 9c4 2 6-2 9 0s6 2 9 0" /></>,
  theremin: <><path d="M4 18c4 0 4-12 8-12s4 12 8 12" /></>,
  chord: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M8 5v8M12 5v8M16 5v8" /></>,
  arp: <><path d="M4 18l4-4 4 3 4-8 4 2" /><circle cx="4" cy="18" r="1" /><circle cx="20" cy="11" r="1" /></>,
  choir: <><circle cx="12" cy="12" r="3" /><path d="M6.5 6.5a8 8 0 000 11M17.5 6.5a8 8 0 010 11" /></>,
  wobble: <><path d="M2 12c2.5-8 4.5-8 7 0s4.5 8 7 0M16 12c1.2-4 2.2-4 3.5 0S22 16 22 12" /></>,
  // інтерфейс
  reverb: <><path d="M3 20h18M5 20V9l7-5 7 5v11" /><path d="M9 20v-6h6v6" /></>,
  echo: <><circle cx="8" cy="12" r="2" /><path d="M13 7a7 7 0 010 10M17 4a11 11 0 010 16" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  volume: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16.5 8.5a5 5 0 010 7" /></>,
  mute: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M17 9l4 6M21 9l-4 6" /></>,
  reset: <><path d="M4 12a8 8 0 108-8H8" /><path d="M11 1L8 4l3 3" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M7 4l13 8-13 8z" />,
  pause: <><path d="M8 5v14M16 5v14" /></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="1.5" />,
  rec: <circle cx="12" cy="12" r="6" />,
  check: <path d="M4 12.5l5 5L20 6.5" />,
  star: <path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.3l1.1-6.2L3 9.7l6.2-.9z" />,
  save: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v5h7V3M8 21v-7h8v7" /></>,
  sliders: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.5 4-6 8-6s7 1.5 8 6" /></>,
  note: <><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v4h16v-4" /></>,
  camera: <><rect x="3" y="6" width="18" height="14" rx="2" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></>,
  moon: <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />,
  party: <><path d="M4 20l5-13 8 8z" /><path d="M14 4v2M20 9h-2M18 3l-1 2" /></>,
};

type Props = { name: string; className?: string; size?: number; fill?: boolean };

function Glyph({ name, className, size, fill }: Props) {
  const body = P[name] ?? P.note;
  const filled = fill ?? ['play', 'stop', 'rec', 'star', 'bolt'].includes(name);
  return (
    <svg
      className={'glyph' + (className ? ' ' + className : '')}
      width={size ?? '1em'}
      height={size ?? '1em'}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {body}
    </svg>
  );
}

export default Glyph;
