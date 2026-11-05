import type { ReactNode } from 'react';
import Glyph from './Glyph';

type Props = { icon: string; title: string; text: string; children?: ReactNode };

function EmptyState({ icon, title, text, children }: Props) {
  return (
    <div className="empty-state">
      <div className="es-art" aria-hidden="true">
        <span className="es-ring" />
        <span className="es-disc">
          <Glyph name={icon} size={44} />
        </span>
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children && <div className="es-actions">{children}</div>}
    </div>
  );
}

export default EmptyState;
