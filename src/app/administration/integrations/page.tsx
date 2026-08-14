import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { canonicalMetricCatalog } from "@/domains/data-ai/canonical-registry";
import { integrationRegistryView } from "@/domains/data-ai/integration-registry";

export const dynamic = "force-dynamic";

export default function IntegrationsAdministrationPage() {
  const integrations = integrationRegistryView();
  const metrics = canonicalMetricCatalog();

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Integrations"
        description="Review data, AI and processing connections used by AccelSSA. Secrets remain in deployment configuration and are never displayed here."
      />

      <section className="table-wrap" aria-label="Integration configuration status">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Purpose</th>
              <th>What to do</th>
            </tr>
          </thead>
          <tbody>
            {integrations.map((integration) => (
              <tr key={integration.id}>
                <td><strong>{integration.name}</strong></td>
                <td>
                  <span className={`status-badge${integration.status === "CONFIGURED" ? "" : " reserved"}`}>
                    {integration.statusLabel}
                  </span>
                </td>
                <td>{integration.description}</td>
                <td>{integration.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section card">
        <div className="section-head">
          <div>
            <h2>Canonical metrics</h2>
            <p>{metrics.length} provider-neutral metrics are registered from the shared location-intelligence catalog.</p>
          </div>
          <Link className="button button-secondary" href="/administration/integrations/metrics">Review metrics</Link>
        </div>
        <p className="muted-note">A configured service means required settings are present. Live provider availability is reported separately under Operational health.</p>
      </section>

      <div className="button-row">
        <Link className="button button-secondary" href="/administration/operations">Operational health</Link>
        <Link className="button button-secondary" href="/search">Search</Link>
        <Link className="button button-secondary" href="/administration">Back to Administration</Link>
      </div>
    </>
  );
}
