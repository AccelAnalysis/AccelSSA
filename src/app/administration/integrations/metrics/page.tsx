import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { canonicalMetricCatalog } from "@/domains/data-ai/canonical-registry";

export default async function CanonicalMetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ metric?: string }>;
}) {
  const { metric } = await searchParams;
  const catalog = canonicalMetricCatalog();
  const selected = metric ? catalog.find((entry) => entry.key === metric) : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="Canonical Metrics"
        description="Provider-neutral definitions keep requirements, analysis and imported observations on one metric vocabulary."
      />

      {selected ? (
        <section className="card">
          <div className="section-head">
            <div>
              <span className="card-kicker">Selected metric</span>
              <h2>{selected.name}</h2>
            </div>
            <span className="status-badge reserved">Observation unavailable</span>
          </div>
          <dl className="definition-list">
            <div className="definition-row"><dt>Metric</dt><dd><span className="code">{selected.key}</span></dd></div>
            <div className="definition-row"><dt>Unit</dt><dd>{selected.unit}</dd></div>
            <div className="definition-row"><dt>Freshness policy</dt><dd>{selected.freshnessDays} days from the source observation date</dd></div>
            <div className="definition-row"><dt>Current value</dt><dd>Unknown — no authoritative observation reader is connected to this view.</dd></div>
          </dl>
        </section>
      ) : null}

      <section className="section table-wrap" aria-label="Canonical metric registry">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Canonical ID</th>
              <th>Unit</th>
              <th>Freshness policy</th>
            </tr>
          </thead>
          <tbody>
            {catalog.map((entry) => (
              <tr key={entry.key}>
                <td><Link className="text-link" href={`/administration/integrations/metrics?metric=${encodeURIComponent(entry.key)}`}>{entry.name}</Link></td>
                <td><span className="code">{entry.key}</span></td>
                <td>{entry.unit}</td>
                <td>{entry.freshnessDays} days</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="button-row">
        <Link className="button button-secondary" href="/administration/integrations">Back to Integrations</Link>
      </div>
    </>
  );
}
