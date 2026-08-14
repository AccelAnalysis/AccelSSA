import { AccountMenu, type AccountMenuProps } from "@/components/auth/account-menu";
import { ProjectSelector } from "@/components/projects/project-selector";

export function Topbar({ account }: { account: AccountMenuProps }) {
  return (
    <header className="topbar">
      <div className="context-stack" aria-label="Current workspace context">
        <div className="context-item">
          <span className="context-label">Organization</span>
          <span className="context-value">{account.tenantName}</span>
        </div>
        <ProjectSelector />
      </div>
      <div className="top-actions"><AccountMenu {...account} /></div>
    </header>
  );
}
