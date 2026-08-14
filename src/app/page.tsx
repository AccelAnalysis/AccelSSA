import { PageHeader } from "@/components/ui/page-header";
import { platformDomains } from "@/platform/domains";

function statusLabel(status: (typeof platformDomains)[number]["status"]) {
  if (status === "FOUNDATION_ACTIVE") return "Foundation active";
  if (status === "RUNTIME_INTEGRATED") return "Runtime integrated";
  return "Domain kernel merged";
}

export default function HomePage() {
  const runtimeIntegrated = platformDomains.filter((domain) => domain.status !== "DOMAIN_KERNEL_MERGED").length;
  return (
    <>
      <PageHeader
        eyebrow="Platform control surface"
        title="AccelSSA Platform Convergence"
        description="All twelve AccelSSA build categories are merged into one repository. The shared Next.js runtime and identity/security domain are integrated directly; the remaining analytical domains are merged as authoritative domain kernels and are validated through the repository release pipeline while their full UI and infrastructure adapters converge."
        status="12 domains merged"
      />

      <section className="grid grid-4" aria-label="Platform status">
        <div className="card"><div className="metric-value">12</div><div className="metric-label">Merged build domains</div></div>
        <div className="card"><div className="metric-value">{runtimeIntegrated}</div><div className="metric-label">Direct runtime domains</div></div>
        <div className="card"><div className="metric-value">v1</div><div className="metric-label">API contract namespace</div></div>
        <div className="card"><div className="metric-value">10</div><div className="metric-label">Domain package suites</div></div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Build domain convergence</h2><p>Category ownership remains explicit after merge.</p></div>
        <div className="grid grid-3">
          {platformDomains.map((domain) => (
            <article className="card module-card" key={domain.number}>
              <div className="module-number">CATEGORY {domain.number}</div>
              <h2>{domain.name}</h2>
              <p>{domain.responsibility}</p>
              <span className={`status-badge${domain.status === "DOMAIN_KERNEL_MERGED" ? " reserved" : ""}`}>{statusLabel(domain.status)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section card">
        <h2>Architectural invariant</h2>
        <p className="callout"><strong>One project model, many analytical views.</strong> The map, scorecards, cost models, site visits, recommendations, client portal and deliverables consume shared authoritative services rather than maintain competing versions of project truth.</p>
      </section>
    </>
  );
}
