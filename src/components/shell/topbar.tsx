import Link from "next/link";

export function Topbar() {
  return (
    <header className="topbar">
      <div className="context-stack" aria-label="Current workspace context">
        <div className="context-pill"><strong>Organization:</strong> Not configured</div>
        <Link className="context-pill project-selector" href="/projects"><strong>Project:</strong> Select project</Link>
      </div>
      <div className="top-actions">
        <div className="user-context" aria-label="User account">
          <div className="user-chip" aria-hidden="true">U</div>
          <span className="user-label">Account</span>
        </div>
      </div>
    </header>
  );
}
