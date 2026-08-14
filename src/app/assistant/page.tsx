import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { getAiProviderConfiguration } from "@/domains/data-ai/integration-registry";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  const provider = getAiProviderConfiguration();
  const providerReady = provider.status === "CONFIGURED";

  return (
    <>
      <PageHeader
        eyebrow="Project assistant"
        title="AI Project Query"
        description="Project questions are available only when the AI service and authorized project data are both ready."
      />

      <section className="table-wrap" aria-label="AI project query readiness">
        <table>
          <thead><tr><th>Requirement</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>AI service</strong></td>
              <td><span className={`status-badge${providerReady ? "" : " reserved"}`}>{provider.statusLabel}</span></td>
              <td>{provider.message}</td>
            </tr>
            <tr>
              <td><strong>Project data</strong></td>
              <td><span className="status-badge reserved">Unavailable</span></td>
              <td>Select an authorized project after project data access is connected.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="section card">
        <h2>Project answers are not available yet</h2>
        <p>AccelSSA will not generate an answer without authorized project data and supporting source references.</p>
      </section>

      <div className="button-row">
        <Link className="button button-secondary" href="/projects">Select project</Link>
      </div>
    </>
  );
}
