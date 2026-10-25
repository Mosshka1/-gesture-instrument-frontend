import type { ReactNode } from 'react';

type Props = {
  crumb: string;
  title: string;
  children?: ReactNode;
};

function PageHeader({ crumb, title, children }: Props) {
  return (
    <header className="page-header">
      <div>
        <div className="crumb">{crumb}</div>
        <h1 className="page-title">{title}</h1>
      </div>
      {children && <div className="header-actions">{children}</div>}
    </header>
  );
}

export default PageHeader;
