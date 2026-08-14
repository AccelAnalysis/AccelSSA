export function PageHeader({ eyebrow, title, description, status }: {
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
}) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="lede">{description}</p>
      </div>
      {status ? <span className="status-badge">{status}</span> : null}
    </header>
  );
}
