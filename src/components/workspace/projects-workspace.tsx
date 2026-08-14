import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

const workflowSteps = [
  ["1", "Define requirements", "Capture the client brief, mandatory constraints, preferred criteria and scenario assumptions."],
  ["2", "Screen markets", "Evaluate candidate geographies, workforce, infrastructure and location intelligence against project requirements."],
  ["3", "Evaluate properties", "Review sites and buildings, utilities, development readiness, due diligence and visit findings."],
  ["4", "Make the decision", "Compare finalists, model costs and incentives, resolve risks and prepare the recommendation and deliverables."],
] as const;

export function ProjectsWorkspace() {
  return (
    <>
      <div className="page-header-with-action">
        <PageHeader
          eyebrow="Site selection workspace"
          title="Projects"
          description="Manage site-selection engagements from client requirements through market screening, property evaluation, due diligence, recommendation and client deliverables."
        />
        <Link className="button button-primary" href="/projects/new">Create Project</Link>
      </div>

      <section className="card empty-state" aria-labelledby="projects-empty-title">
        <div className="empty-state-mark" aria-hidden="true">+</div>
        <div>
          <h2 id="projects-empty-title">No projects yet</h2>
          <p>Create your first site-selection project to define requirements and begin geographic screening.</p>
        </div>
        <Link className="button button-primary" href="/projects/new">Create Project</Link>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <h2>Site selection workflow</h2>
            <p>One engagement workspace carries the decision from client brief to final recommendation.</p>
          </div>
        </div>
        <div className="grid grid-4 workflow-grid">
          {workflowSteps.map(([step, title, description]) => (
            <article className="card workflow-card" key={step}>
              <div className="workflow-step">{step}</div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section grid grid-3">
        <article className="card attention-card">
          <span className="card-kicker">Projects requiring attention</span>
          <h2>Nothing requires attention</h2>
          <p>Open risks, missing required information and upcoming deadlines will appear here when projects are active.</p>
        </article>
        <article className="card attention-card">
          <span className="card-kicker">Upcoming visits</span>
          <h2>No site visits scheduled</h2>
          <p>Planned site visits will appear here with dates, candidates and itinerary context.</p>
        </article>
        <article className="card attention-card">
          <span className="card-kicker">Recent deliverables</span>
          <h2>No deliverables yet</h2>
          <p>Approved comparisons, recommendation packages and reports will appear here.</p>
        </article>
      </section>
    </>
  );
}
