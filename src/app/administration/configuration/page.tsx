import { PageHeader } from "@/components/ui/page-header";

const settings = [
  ["Project stages", "Define the stages used to move engagements from intake through screening, diligence, recommendation and closeout."],
  ["Requirement categories", "Organize mandatory, preferred and informational client criteria consistently across projects."],
  ["Scoring categories", "Maintain reusable decision dimensions such as workforce, logistics, utilities, real estate and business climate."],
  ["Risk classifications", "Standardize risk categories, severity conventions and project review expectations."],
  ["Property types", "Maintain the site and building classifications used by the property registry."],
  ["Client visibility defaults", "Set organization defaults for internal, project-team, client and externally shared information."],
] as const;

export default function ConfigurationPage() {
  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Project Configuration"
        description="Maintain reusable organization standards that keep project setup, screening, comparison and reporting consistent."
      />
      <div className="grid grid-2">
        {settings.map(([title, description]) => (
          <article className="card settings-card" key={title}>
            <h2>{title}</h2>
            <p>{description}</p>
            <span className="muted-note">No organization-specific values configured.</span>
          </article>
        ))}
      </div>
    </>
  );
}
