import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { getAiProviderConfiguration } from "@/domains/data-ai/integration-registry";
import { projectQueryToolNames } from "@/domains/data-ai/project-query-tools";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  const provider = getAiProviderConfiguration();
  const providerReady = provider.status === "CONFIGURED";

  return (
    <>
      <PageHeader
        eyebrow="Project assistant"
        title="AI Project Query"
        description="Grounded answers use authorized project tools and source references. AccelSSA does not answer from an ungrounded provider connection."
      />

      <section className="table-wrap" aria-label="AI project query readiness">
        <table>
          <thead><tr><th>Capability</th><th>Status</th><th>Detail</th></tr></thead>
          <tbody>
            <tr>
              <td><strong>AI provider</strong></td>
              <td><span className={`status-badge${providerReady ? "" : " reserved"}`}>{provider.statusLabel}</span></td>
              <td>{provider.message}</td>
            </tr>
            <tr>
              <td><strong>Authorized project grounding</strong></td>
              <td><span className="status-badge reserved">Unavailable</span></td>
              <td>No authenticated selected-project data source is connected to this route.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="section card">
        <h2>Grounded tools</h2>
        <p>{projectQueryToolNames().length} project query tools are registered for requirements, candidate analysis, properties, risks, financial comparison, visits and evidence. They remain inactive until project authorization and authoritative data retrieval are available.</p>
      </section>

      <div className="button-row">
        <Link className="button button-secondary" href="/administration/integrations">AI configuration</Link>
        <Link className="button button-secondary" href="/projects">Select project</Link>
      </div>
    </>
  );
}
