import Link from "next/link";
import { getDomainByPath } from "@/platform/domains";

export function ModulePlaceholder({ path }: { path: string }) {
  const domain = getDomainByPath(path);
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Reserved domain surface</div>
          <h1>{domain?.name ?? "AccelSSA module"}</h1>
          <p className="lede">
            The shared Category 1 shell and route are active. Substantive business behavior remains owned by the designated build category.
          </p>
        </div>
        <span className="status-badge reserved">Reserved</span>
      </header>
      <div className="card">
        <h2>Platform boundary</h2>
        <p>{domain?.responsibility}</p>
        <p>
          Implement this domain under <span className="code">src/domains/{domain?.slug}</span> and reuse the platform contracts in <span className="code">src/platform</span>.
        </p>
        <p><Link href="/">Return to platform overview →</Link></p>
      </div>
    </>
  );
}
