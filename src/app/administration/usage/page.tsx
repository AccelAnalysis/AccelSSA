import { PageHeader } from "@/components/ui/page-header";

export default function UsagePage() {
  return <><PageHeader eyebrow="Administration" title="Runtime & Usage" description="Foundation visibility into the runtime classes that later operations and observability work will instrument." />
  <div className="grid grid-4"><div className="card"><div className="metric-value">5</div><div className="metric-label">Storage workload classes</div></div><div className="card"><div className="metric-value">6</div><div className="metric-label">Job lifecycle states</div></div><div className="card"><div className="metric-value">4</div><div className="metric-label">Configuration scopes</div></div><div className="card"><div className="metric-value">v1</div><div className="metric-label">API namespace</div></div></div>
  <section className="section card"><h2>Persistence workloads</h2><p>Operational data · geospatial data · analytical data · file/object storage · search indexes.</p></section>
  <section className="section card"><h2>Long-running operations</h2><p>Mass screening, metric refresh, spatial calculations, bulk imports, document/report processing, AI analysis, score recalculation, freshness checks and notifications use background-job contracts rather than blocking request/response execution.</p></section></>;
}
