import { PrimaryNavigation } from "./primary-navigation";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div className="brand-copy">
            <strong>AccelSSA</strong>
            <span>Decision Management</span>
          </div>
        </div>
        <PrimaryNavigation />
        <div className="sidebar-footer">
          Category 1 foundation<br />
          One project model · many analytical views
        </div>
      </aside>
      <div className="shell-main">
        <Topbar />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
