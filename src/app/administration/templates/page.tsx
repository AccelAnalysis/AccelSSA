import { PageHeader } from "@/components/ui/page-header";

const templateFamilies = [
  ["Project templates", "Reusable engagement stages, task patterns and project defaults for common facility types."],
  ["Requirement libraries", "Reusable client criteria for manufacturing, distribution, office, data center and other project types."],
  ["Scoring templates", "Reusable decision categories, factors, weights and scenario starting points."],
  ["Risk frameworks", "Reusable due-diligence and risk review structures."],
  ["Site visit templates", "Reusable field checklists, ratings and information-request structures."],
  ["Report templates", "Reusable branding, section order and presentation defaults for client deliverables."],
] as const;

export default function TemplatesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Templates"
        description="Create reusable starting points for projects while preserving the historical project information used for earlier decisions."
      />
      <div className="grid grid-3">
        {templateFamilies.map(([name, description]) => (
          <article className="card settings-card" key={name}>
            <h2>{name}</h2>
            <p>{description}</p>
            <span className="muted-note">No organization templates configured.</span>
          </article>
        ))}
      </div>
      <p className="callout section">Template updates should apply to future projects or explicit project updates; they should not silently rewrite completed analyses or prior client decisions.</p>
    </>
  );
}
