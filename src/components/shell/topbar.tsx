import Link from "next/link";
import { AccountMenu, type AccountMenuProps } from "@/components/auth/account-menu";

export function Topbar({ account }: { account: AccountMenuProps }) {
  return (
    <header className="topbar">
      <div className="context-stack" aria-label="Current workspace context">
        <div className="context-item">
          <span className="context-label">Organization</span>
          <span className="context-value">{account.tenantName}</span>
        </div>
        <Link className="context-item project-selector" href="/projects">
          <span className="context-label">Project</span>
          <span className="context-value">Select</span>
        </Link>
      </div>
      <div className="top-actions"><AccountMenu {...account} /></div>
    </header>
  );
}
