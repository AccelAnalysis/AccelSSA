import { PageHeader } from "@/components/ui/page-header";

export default function UsagePage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Usage & Activity"
        description="Review organization activity, project volume and service usage when operational records are available."
      />
      <section className="card empty-state">
        <div className="empty-state-mark" aria-hidden="true">•</div>
        <div>
          <h2>No usage history yet</h2>
          <p>Project and organization activity will appear here after the first live engagement begins.</p>
        </div>
      </section>
      <section className="section grid grid-3">
        <article className="card"><h2>Project activity</h2><p>Active, completed and archived engagement activity will be summarized here.</p></article>
        <article className="card"><h2>Team activity</h2><p>Organization administrators will be able to review membership and collaboration activity.</p></article>
        <article className="card"><h2>Service usage</h2><p>Data, document and analytical service usage will be summarized when usage records are available.</p></article>
      </section>
    </>
  );
}
