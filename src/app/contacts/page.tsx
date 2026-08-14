import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default function ContactsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Stakeholders"
        title="Contacts"
        description="Keep project relationships organized across client leaders, brokers, property owners, utilities, economic developers, local officials and specialist partners."
      />
      <section className="card empty-state">
        <div className="empty-state-mark" aria-hidden="true">+</div>
        <div>
          <h2>No project contacts yet</h2>
          <p>Contacts will appear here when they are associated with an active client, project or candidate location.</p>
        </div>
        <Link className="button button-primary" href="/projects">Select project</Link>
      </section>
      <section className="section grid grid-3">
        <article className="card"><h2>Client team</h2><p>Track executives, project-team participants and the people responsible for client decisions and information requests.</p></article>
        <article className="card"><h2>Location stakeholders</h2><p>Organize economic development, utility, government and community contacts by candidate geography.</p></article>
        <article className="card"><h2>Property stakeholders</h2><p>Associate brokers, owners, developers, engineers and other property-specific contacts with candidate sites.</p></article>
      </section>
    </>
  );
}
