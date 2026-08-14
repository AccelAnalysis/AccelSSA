import Link from "next/link";
import { PageHeader } from "./page-header";

const workspaceContent = {
  "/locations": {
    eyebrow: "Market screening",
    title: "Locations",
    description: "Explore candidate geographies and evaluate market fit using workforce, infrastructure, logistics and spatial criteria tied to a site-selection project.",
    emptyTitle: "Select a project to begin market screening",
    emptyCopy: "Candidate markets, map views and screening results are project-specific. Choose an active project before adding locations to the evaluation set.",
    cards: [
      ["Screen markets", "Apply mandatory requirements and preferred criteria across target geographies."],
      ["Explore spatial context", "Review location relationships, transportation access and geographic constraints."],
      ["Advance candidates", "Move qualified markets into deeper comparison and property evaluation."],
    ],
  },
  "/properties": {
    eyebrow: "Sites & buildings",
    title: "Properties",
    description: "Review candidate sites and buildings, availability, utilities, transportation, environmental information and development readiness.",
    emptyTitle: "No properties under review",
    emptyCopy: "Select a project, then add candidate sites or buildings from the property registry and location workspace.",
    cards: [
      ["Property profile", "Track acreage or building characteristics, availability, ownership and commercial terms."],
      ["Readiness", "Review zoning, environmental work, utilities, permitting and development timing."],
      ["Verification", "Keep source, evidence, confidence and freshness attached to important property facts."],
    ],
  },
  "/analysis": {
    eyebrow: "Decision analytics",
    title: "Analysis",
    description: "Compare viable markets and properties across requirements, scenarios, workforce, costs, incentives, readiness and risk without allowing a high score to hide a failed mandatory requirement.",
    emptyTitle: "No project analysis available",
    emptyCopy: "Select a project with defined requirements and candidate locations to begin qualification, scoring and comparison.",
    cards: [
      ["Qualification", "Evaluate mandatory requirements separately from weighted attractiveness."],
      ["Scenarios & comparison", "Compare candidates under balanced, workforce, cost, logistics or client-defined priorities."],
      ["Costs, incentives & risk", "Bring financial differences, incentive value and unresolved risk into the decision."],
    ],
  },
  "/visits": {
    eyebrow: "Fieldwork",
    title: "Visits",
    description: "Plan site visits, organize itineraries and capture field observations, evidence, open questions and follow-up actions for shortlisted candidates.",
    emptyTitle: "No site visits scheduled",
    emptyCopy: "Site visits appear after candidate properties advance far enough for field review. Select a project to plan or review upcoming visits.",
    cards: [
      ["Plan the itinerary", "Organize candidate stops, hosts, participants, timing and travel sequence."],
      ["Capture findings", "Record notes, photos, checklist results, open questions and follow-up actions."],
      ["Inform the decision", "Connect verified findings to risks, readiness and the final recommendation."],
    ],
  },
  "/deliverables": {
    eyebrow: "Client deliverables",
    title: "Deliverables",
    description: "Prepare client-ready comparisons, property profiles, site-visit books, financial analyses and recommendation packages from the project decision record.",
    emptyTitle: "No deliverables yet",
    emptyCopy: "Approved project analysis and recommendation content will appear here when a project is ready for client-facing output.",
    cards: [
      ["Decision summaries", "Present the short list, comparisons and key reasons candidates advanced or were eliminated."],
      ["Recommendation", "Synthesize requirements, costs, incentives, readiness, risk and consultant judgment."],
      ["Client-ready output", "Produce consistent reports and presentation material from approved project information."],
    ],
  },
} as const;

export function ModulePlaceholder({ path }: { path: keyof typeof workspaceContent }) {
  const content = workspaceContent[path];
  return (
    <>
      <PageHeader eyebrow={content.eyebrow} title={content.title} description={content.description} />
      <section className="card empty-state">
        <div className="empty-state-mark" aria-hidden="true">•</div>
        <div>
          <h2>{content.emptyTitle}</h2>
          <p>{content.emptyCopy}</p>
        </div>
        <Link className="button button-primary" href="/projects">Select project</Link>
      </section>
      <section className="section grid grid-3">
        {content.cards.map(([title, description]) => (
          <article className="card" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </>
  );
}
