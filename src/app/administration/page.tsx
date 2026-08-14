import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { administrationNavigation } from "@/platform/navigation";

const descriptions: Record<string, string> = {
  "/administration/firm": "Manage organization details, branding and project defaults.",
  "/administration/configuration": "Manage reusable project stages, classifications and decision settings.",
  "/administration/templates": "Maintain reusable project, requirement, scoring, risk, visit and report templates.",
  "/administration/usage": "Review organization activity and usage when records are available.",
};

export default function AdministrationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Administration"
        description="Manage the organization settings and reusable standards that shape site-selection projects and client deliverables."
      />
      <div className="grid grid-2">
        {administrationNavigation.map((item) => (
          <Link href={item.href} className="card settings-card" key={item.href}>
            <h2>{item.label}</h2>
            <p>{descriptions[item.href]}</p>
            <span className="text-link">Open settings →</span>
          </Link>
        ))}
      </div>
      <section className="section card">
        <h2>Access</h2>
        <p>Administrative changes should be limited to authorized organization administrators. Client and external-contributor workspaces should not expose organization settings.</p>
      </section>
    </>
  );
}
