import Link from "next/link";
import { getDomainByPath } from "@/platform/domains";

export function ModulePlaceholder({ path }: { path: string }) {
  const domain = getDomainByPath(path);
  return (
    <>
      <header className="page-header">
        <div>
          <div className="eyebrow">Converged domain surface</div>
          <h1>{domain?.name ?? "AccelSSA module"}</h1>
          <p className="lede">
            The authoritative domain kernel is merged into the AccelSSA repository. This route remains the shared application-shell integration surface while persistence, provider, and full workflow UI adapters are wired to the domain contracts.
          </p>
        </div>
        <span className="status-badge reserved">Domain kernel merged</span>
      </header>
      <div className="card">
        <h2>Platform boundary</h2>
        <p>{domain?.responsibility}</p>
        <p>
          Runtime adapters must preserve the shared tenant, project, candidate, metric, provenance, evidence, visibility, audit, version, and decision contracts rather than introduce a second source of truth.
        </p>
        <p><Link href="/">Return to platform overview →</Link></p>
      </div>
    </>
  );
}
