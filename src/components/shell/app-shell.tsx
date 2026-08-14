import Link from "next/link";
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
            <span>Site Selection</span>
          </div>
        </div>
        <PrimaryNavigation />
        <div className="sidebar-footer">
          <Link href="/administration">Settings</Link>
          <span className="sidebar-separator" aria-hidden="true">·</span>
          <span>Site Selection Workspace</span>
        </div>
      </aside>
      <div className="shell-main">
        <Topbar />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
