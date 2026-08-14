import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { searchApplicationCatalog } from "@/domains/data-ai/search-runtime";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const results = query ? searchApplicationCatalog(query) : [];

  return (
    <>
      <PageHeader
        eyebrow="Search"
        title="Global Search"
        description="Find AccelSSA workspaces, canonical metrics and configured services. Authorized project records appear only when project indexing is connected."
      />

      <form className="card" method="get" action="/search" role="search">
        <label htmlFor="global-search"><strong>Search</strong></label>
        <div className="button-row">
          <input
            id="global-search"
            name="q"
            defaultValue={query}
            placeholder="Search projects, locations, metrics or settings"
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
                      <td>{result.kind === "workspace" ? "Workspace" : result.kind === "metric" ? "Metric" : "Integration"}</td>
                      <td>{result.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card empty-state">
              <div className="empty-state-mark" aria-hidden="true">•</div>
              <div><h2>No results</h2><p>Try a workspace name, metric, or integration.</p></div>
            </div>
          )}
        </section>
      ) : (
        <section className="section card">
          <h2>Search scope</h2>
          <p>Workspace navigation, canonical metric definitions and integration status are available now. Project and client records are not indexed until an authorized project-search adapter is connected.</p>
        </section>
      )}
    </>
  );
}
