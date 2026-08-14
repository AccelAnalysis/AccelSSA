import { PageHeader } from "@/components/ui/page-header";
import { platformDomains } from "@/platform/domains";

export default function HomePage() {
  const active = platformDomains.filter((domain) => domain.status === "FOUNDATION_ACTIVE").length;
  return (
    <>
      <PageHeader
        eyebrow="Platform control surface"
        title="AccelSSA Foundation"
        description="The shared runtime and administration backbone for a map-centered Site Selection Decision Management Platform. Domain routes are intentionally present before their substantive implementations so every build category converges on one shell and one set of contracts."
        status="Foundation active"
      />

      <section className="grid grid-4" aria-label="Foundation status">
        <div className="card"><div className="metric-value">12</div><div className="metric-label">Platform build domains</div></div>
        <div className="card"><div className="metric-value">{active}</div><div className="metric-label">Foundation domain active</div></div>
        <div className="card"><div className="metric-value">v1</div><div className="metric-label">API contract namespace</div></div>
        <div className="card"><div className="metric-value">5</div><div className="metric-label">Persistence workload classes</div></div>
      </section>

      <section className="section">
        <div className="section-head"><h2>Build domain convergence</h2><p>Category ownership is explicit.</p></div>
        <div className="grid grid-3">
          {platformDomains.map((domain) => (
            <article className="card module-card" key={domain.number}>
              <div className="module-number">CATEGORY {domain.number}</div>
              <h2>{domain.name}</h2>
              <p>{domain.responsibility}</p>
              <span className={`status-badge${domain.status === "RESERVED" ? " reserved" : ""}`}>{domain.status === "FOUNDATION_ACTIVE" ? "Active" : "Reserved"}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="section card">
        <h2>Architectural invariant</h2>
        <p className="callout"><strong>One project model, many analytical views.</strong> The map, scorecards, cost models, site visits, recommendations, client portal and deliverables must consume shared authoritative services rather than maintain competing versions of project truth.</p>
      </section>
    </>
  );
}
