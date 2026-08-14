import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default function OrganizationAdministrationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Organization"
        description="Manage the firm identity, branding and defaults used across project workspaces and client-facing deliverables."
      />
      <div className="grid grid-2">
        <section className="card">
          <span className="card-kicker">Organization profile</span>
          <h2>Not configured</h2>
          <p>Add the organization name and administrative contact details before creating the first live project.</p>
          <dl className="definition-list section-compact">
            <div className="definition-row"><dt>Organization name</dt><dd>Not configured</dd></div>
            <div className="definition-row"><dt>Administrative contact</dt><dd>Not configured</dd></div>
            <div className="definition-row"><dt>Default confidentiality</dt><dd>Not configured</dd></div>
          </dl>
        </section>
        <section className="card">
          <span className="card-kicker">Branding</span>
          <h2>Client presentation defaults</h2>
          <p>Organization branding will be used for approved reports, presentations and other client deliverables.</p>
          <ul className="clean-list">
            <li>Logo and organization identity</li>
            <li>Report presentation preferences</li>
            <li>Standard disclosures and methodology language</li>
          </ul>
        </section>
      </div>
      <div className="button-row section">
        <Link className="button button-secondary" href="/administration">Back to Administration</Link>
      </div>
    </>
  );
}
