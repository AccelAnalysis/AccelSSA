import Link from "next/link";
import { AccountMenu, type AccountMenuProps } from "@/components/auth/account-menu";

export function Topbar({ account }: { account: AccountMenuProps }) {
  return (
    <header className="topbar">
      <div className="context-stack" aria-label="Current workspace context">
        <div className="context-pill"><strong>Organization:</strong> {account.tenantName}</div>
        <Link className="context-pill project-selector" href="/projects"><strong>Project:</strong> Select project</Link>
      </div>
      <div className="top-actions"><AccountMenu {...account} /></div>
    </header>
  );
}
