import Link from "next/link";

export function Topbar() {
  return (
    <header className="topbar">
      <div className="context-stack" aria-label="Current workspace context">
        <div className="context-item">
          <span className="context-label">Organization</span>
          <span className="context-value">Not configured</span>
        </div>
        <Link className="context-item project-selector" href="/projects">
          <span className="context-label">Project</span>
          <span className="context-value">Select</span>
        </Link>
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
