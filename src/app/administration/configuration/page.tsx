import { PageHeader } from "@/components/ui/page-header";
import { configurableRegistries } from "@/platform/admin";

export default function ConfigurationPage() {
  return (
    <>
      <PageHeader eyebrow="Administration" title="Configuration Registries" description="Configurable structures replace hardcoded platform terminology and category lists. Resolution supports platform, firm, template and project scopes with published-version precedence." status="Registry contract active" />
      <div className="table-wrap"><table><thead><tr><th>Registry key</th><th>Owner</th><th>Foundation behavior</th></tr></thead><tbody>{configurableRegistries.map((key) => <tr key={key}><td><span className="code">{key}</span></td><td>{key.startsWith("project") ? "Category 3" : key.startsWith("requirement") ? "Category 4" : key.startsWith("score") ? "Category 8" : key.startsWith("risk") || key.startsWith("site-visit") ? "Category 10" : key.startsWith("property") ? "Category 7" : key.startsWith("report") || key.startsWith("document") || key.startsWith("client") ? "Category 11" : "Platform"}</td><td>Version-ready registry slot; domain validates substantive values.</td></tr>)}</tbody></table></div>
      <p className="callout section">Precedence: Project → Template → Tenant → Platform. Only published versions resolve into runtime configuration.</p>
    </>
  );
}
