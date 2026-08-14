import { PageHeader } from "@/components/ui/page-header";

export default function FirmAdministrationPage() {
  return (
    <>
      <PageHeader eyebrow="Administration" title="Firm Profile & Branding" description="Foundation-level firm metadata and reusable presentation configuration. Identity-backed editing activates with Category 2." />
      <div className="grid grid-2">
        <div className="card"><h2>Firm profile contract</h2><dl className="definition-list"><div className="definition-row"><dt>Identity</dt><dd>Legal/operating name and administrative contacts.</dd></div><div className="definition-row"><dt>Defaults</dt><dd>Tenant-level configuration inherited by templates and projects.</dd></div><div className="definition-row"><dt>Confidentiality</dt><dd>Default classification references; enforcement remains Category 2.</dd></div></dl></div>
        <div className="card"><h2>Branding contract</h2><dl className="definition-list"><div className="definition-row"><dt>Brand assets</dt><dd>Logo references and reusable visual identity metadata.</dd></div><div className="definition-row"><dt>Deliverables</dt><dd>Brand settings may be consumed by Category 11 report templates.</dd></div><div className="definition-row"><dt>Versioning</dt><dd>Published changes should not silently rewrite historical deliverables.</dd></div></dl></div>
      </div>
      <p className="callout section">Administrative mutation is intentionally not exposed before authenticated firm-administrator authority is implemented by Category 2.</p>
    </>
  );
}
