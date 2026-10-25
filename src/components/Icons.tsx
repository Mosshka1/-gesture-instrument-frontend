type P = { className?: string };

const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconPlay = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="5" width="17" height="14" rx="3" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconModes = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="4" width="7" height="7" rx="2" />
    <rect x="13.5" y="4" width="7" height="7" rx="2" />
    <rect x="3.5" y="14" width="7" height="6" rx="2" />
    <rect x="13.5" y="14" width="7" height="6" rx="2" />
  </svg>
);

export const IconPresets = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>
);

export const IconRecordings = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M7 5.5v13l11-6.5z" />
  </svg>
);

export const IconSounds = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9 18V6l10-2v12" />
    <circle cx="6.5" cy="18" r="2.5" />
    <circle cx="16.5" cy="16" r="2.5" />
  </svg>
);

export const IconHelp = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 5 .2c0 1.6-2.5 2-2.5 3.8M12 17h.01" />
  </svg>
);

export const IconGear = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);

export const IconFullscreen = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
  </svg>
);

export const IconDownload = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M12 4v12M7 11l5 5 5-5M5 20h14" />
  </svg>
);

export const IconEdit = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 20h4L19 9l-4-4L4 16z" />
  </svg>
);

export const IconTrash = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6" />
  </svg>
);
