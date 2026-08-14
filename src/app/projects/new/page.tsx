import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export default function NewProjectPage() {
  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="Create Project"
        description="Start a site-selection engagement by establishing the client, facility profile, target geography, investment, employment and opening timeline."
      />
      <div className="grid grid-2">
        <section className="card">
          <h2>Project setup</h2>
          <p>Your organization does not yet have an active project workspace to save a new engagement. Complete organization setup before creating the first live project.</p>
          <div className="button-row">
            <Link className="button button-primary" href="/administration/firm">Open organization setup</Link>
            <Link className="button button-secondary" href="/projects">Back to Projects</Link>
          </div>
        </section>
        <section className="card">
          <span className="card-kicker">Project brief</span>
          <h2>Information you will capture</h2>
          <ul className="clean-list">
            <li>Client and project name</li>
            <li>Facility and project type</li>
            <li>Target geographies</li>
            <li>Capital investment and planned employment</li>
            <li>Average wage and target opening date</li>
            <li>Confidentiality and project leadership</li>
          </ul>
        </section>
      </div>
    </>
  );
}
