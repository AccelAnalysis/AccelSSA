import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { operationalSnapshot } from "@/domains/data-ai/runtime-status";

export const dynamic = "force-dynamic";

export default function OperationsAdministrationPage() {
  const snapshot = operationalSnapshot();

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Operational Health"
        description="See which platform capabilities are ready, which need configuration and which are not available in the current deployment."
      />

      <section className="card">
        <div className="section-head">
          <div>
            <span className="card-kicker">Readiness</span>
            <h2>{snapshot.readinessLabel}</h2>
          </div>
          <span className={`status-badge${snapshot.readiness === "READY" ? "" : " reserved"}`}>
            {snapshot.readinessLabel}
          </span>
        </div>
        <p className="muted-note">Checked {new Date(snapshot.checkedAt).toLocaleString()}. Configuration readiness does not claim a third-party provider is reachable unless a live adapter reports that state.</p>
      </section>

      <section className="section table-wrap" aria-label="Operational capability status">
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.capabilities.map((capability) => (
              <tr key={capability.id}>
                <td><strong>{capability.name}</strong></td>
                <td>
                  <span className={`status-badge${capability.status === "CONFIGURED" ? "" : " reserved"}`}>
                    {capability.statusLabel}
                  </span>
                </td>
                <td>{capability.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="section card">
        <h2>Background work</h2>
        <p>Job history is shown only when a durable status reader is connected. AccelSSA does not display an empty queue as a successful job state when job history is unavailable.</p>
      </section>

      <div className="button-row">
        <Link className="button button-secondary" href="/administration/integrations">Integrations</Link>
        <Link className="button button-secondary" href="/administration">Back to Administration</Link>
      </div>
    </>
  );
}
