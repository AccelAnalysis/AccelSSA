import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectCreateForm } from "@/components/projects/project-create-form";

export default function NewProjectPage() {
  const configured = Boolean(process.env.DATABASE_URL);
  return (
    <>
      <div className="page-header-with-action">
        <PageHeader eyebrow="Projects" title="Create Project" description="Establish the client, operating requirements and timeline for a new site-selection engagement." />
        <Link className="button button-secondary" href="/projects">Cancel</Link>
      </div>
      {configured ? (
        <ProjectCreateForm />
      ) : (
        <div className="inline-notice" role="status">
          Project creation is unavailable until the authoritative PostgreSQL connection (`DATABASE_URL`) is configured.
        </div>
      )}
    </>
  );
}
