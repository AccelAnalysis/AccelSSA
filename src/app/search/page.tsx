import Link from "next/link";
import { headers } from "next/headers";
import { PageHeader } from "@/components/ui/page-header";
import { isFirmAdministrator, resolveWorkspaceAccess } from "@/domains/identity-security/request-access";
import { searchApplicationCatalog, type GlobalSearchResultKind } from "@/domains/data-ai/search-runtime";

export const dynamic = "force-dynamic";

const resultTypeLabels: Readonly<Record<GlobalSearchResultKind, string>> = {
  workspace: "Workspace",
  project: "Project",
  client: "Client",
  metric: "Metric",
  integration: "Integration",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q = "" }, requestHeaders] = await Promise.all([searchParams, headers()]);
  const access = await resolveWorkspaceAccess(requestHeaders.get("cookie"));
  const query = q.trim();
  const includeAdministration = isFirmAdministrator(access);
  const results = query ? searchApplicationCatalog(query, { includeAdministration }) : [];

  return (
    <>
      <PageHeader
        eyebrow="Search"
        title="Global Search"
        description="Find workspaces you can access. Authorized project records appear only when project indexing is connected."
      />

      <form className="card" method="get" action="/search" role="search">
        <label htmlFor="global-search"><strong>Search</strong></label>
        <div className="button-row">
          <input
            id="global-search"
            name="q"
            defaultValue={query}
            placeholder="Search projects or workspaces"
            aria-label="Search AccelSSA"
          />
          <button className="button button-primary" type="submit">Search</button>
        </div>
      </form>

      {query ? (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Results</h2>
              <p>{results.length} result{results.length === 1 ? "" : "s"} for “{query}”.</p>
            </div>
          </div>
          {results.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Type</th><th>Details</th></tr></thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={`${result.kind}:${result.id}`}>
                      <td><Link href={result.href}><strong>{result.title}</strong></Link></td>
                      <td>{resultTypeLabels[result.kind]}</td>
                      <td>{result.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card empty-state">
              <div className="empty-state-mark" aria-hidden="true">•</div>
              <div><h2>No results</h2><p>Try another workspace or project term.</p></div>
            </div>
          )}
        </section>
      ) : (
        <section className="section card">
          <h2>Search scope</h2>
          <p>Workspace navigation is available now. Project and client records will appear only from the authorized project index.</p>
        </section>
      )}
    </>
  );
}
