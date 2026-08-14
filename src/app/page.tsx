import { headers } from "next/headers";
import { ProjectInfrastructureNotice, ProjectsWorkspace } from "@/components/workspace/projects-workspace";
import { ProjectInfrastructureError, projectInfrastructureStatus, readProjectList } from "@/domains/projects-workflow/runtime";

export default async function HomePage() {
  const configuration = projectInfrastructureStatus();
  if (!configuration.ready) return <ProjectInfrastructureNotice issues={configuration.issues} />;
  try {
    const result = await readProjectList(await headers());
    return <ProjectsWorkspace projects={result.projects} riskDataAvailable={result.riskDataAvailable} />;
  } catch (error) {
    const issues = error instanceof ProjectInfrastructureError ? error.issues : ["Projects could not be read from the authoritative project store."];
    return <ProjectInfrastructureNotice issues={issues} />;
  }
}
