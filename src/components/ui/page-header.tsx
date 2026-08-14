import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  status,
  showDescription = false,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  status?: string;
  showDescription?: boolean;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-heading">
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {showDescription && description ? <p className="lede">{description}</p> : null}
      </div>
      {status || actions ? (
        <div className="page-header-actions">
          {status ? <span className="status-badge">{status}</span> : null}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
