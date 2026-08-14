export function Topbar() {
  return (
    <header className="topbar">
      <div className="context-stack" aria-label="Current context">
        <div className="context-pill"><strong>Firm:</strong> Foundation preview</div>
        <div className="context-pill"><strong>Project:</strong> No project selected</div>
      </div>
      <div className="top-actions">
        <div className="search-box" aria-label="Global search placeholder">Search projects, locations, properties…</div>
        <div className="user-chip" title="Identity is activated by Category 2">C2</div>
      </div>
    </header>
  );
}
