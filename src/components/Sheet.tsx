import { useEffect } from 'react';
import type { ReactNode } from 'react';

// Нижня шторка для телефонів: не закриває камеру повністю й гортається
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <div className="panel-head" style={{ marginBottom: 8 }}>
          <h3>{title}</h3>
          <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={onClose} aria-label="Закрити">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default Sheet;
