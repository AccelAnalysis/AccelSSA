import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { administrationCapabilities } from "@/platform/admin";
import { administrationNavigation } from "@/platform/navigation";

export default function AdministrationPage() {
  return (
    <>
      <PageHeader eyebrow="Category 1" title="Firm Administration" description="The tenant control plane for firm profile, reusable configuration, templates, runtime usage and future integration administration." status="Foundation active" />
      <div className="grid grid-2">
        {administrationNavigation.map((item) => <Link href={item.href} className="card" key={item.href}><h2>{item.label}</h2><p>Open {item.label.toLowerCase()} administration →</p></Link>)}
      </div>
      <section className="section">
        <div className="section-head"><h2>Administrative capability boundaries</h2><p>Writes requiring identity remain closed until Category 2.</p></div>
        <div className="table-wrap"><table><thead><tr><th>Capability</th><th>Status</th><th>Boundary</th></tr></thead><tbody>{administrationCapabilities.map((item) => <tr key={item.key}><td><strong>{item.label}</strong><br/><span className="code">{item.key}</span></td><td>{item.state}</td><td>{item.description}</td></tr>)}</tbody></table></div>
      </section>
    </>
  );
}
