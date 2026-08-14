import { PrimaryNavigation } from "./primary-navigation";
import { Topbar } from "./topbar";
import type { AccountMenuProps } from "@/components/auth/account-menu";

export function AppShell({ children, account }: { children: React.ReactNode; account: AccountMenuProps }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Application navigation">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div className="brand-copy">
            <strong>AccelSSA</strong>
            <span>Site Selection</span>
          </div>
        </div>
        <PrimaryNavigation />
      </aside>
      <div className="shell-main">
        <Topbar account={account} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
