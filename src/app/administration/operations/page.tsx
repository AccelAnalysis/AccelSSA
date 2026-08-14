import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { resolveWorkspaceAccess } from "@/domains/identity-security/request-access";
import { operationalSnapshot } from "@/domains/data-ai/runtime-status";

export const dynamic = "force-dynamic";

export default async function OperationsAdministrationPage() {
  const requestHeaders = await headers();
  const access = await resolveWorkspaceAccess(requestHeaders.get("cookie"));
  const snapshot = await operationalSnapshot({ tenantId: access.tenant?.tenantId });

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
        <p className="muted-note">Checked {new Date(snapshot.checkedAt).toLocaleString()}. Core readiness is based on the project data store and workspace search; optional providers are reported separately.</p>
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

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Background jobs</h2>
            <p>Most recent tenant-scoped work from the authoritative platform job table.</p>
          </div>
        </div>
        {snapshot.backgroundJobs.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Status</th><th>Progress</th><th>Attempts</th><th>Updated</th></tr></thead>
              <tbody>
                {snapshot.backgroundJobs.map((job) => (
                  <tr key={job.id}>
                    <td><strong>{job.type}</strong></td>
                    <td><span className={`status-badge${job.status === "SUCCEEDED" ? "" : " reserved"}`}>{job.status.replaceAll("_", " ")}</span></td>
                    <td>{job.progress}%</td>
                    <td>{job.attempt} / {job.maxAttempts}</td>
                    <td>{new Date(job.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card empty-state">
            <div className="empty-state-mark" aria-hidden="true">•</div>
            <div><h2>No job records to show</h2><p>{snapshot.capabilities.find((capability) => capability.id === "job-history")?.detail}</p></div>
          </div>
        )}
      </section>

      <div className="button-row">
        <Link className="button button-secondary" href="/administration/integrations">Integrations</Link>
        <Link className="button button-secondary" href="/administration">Back to Administration</Link>
      </div>
    </>
  );
}
