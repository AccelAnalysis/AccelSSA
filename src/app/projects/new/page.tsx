import { headers } from "next/headers";
import { ProjectCreateForm } from "@/components/workspace/project-create-form";
import { ProjectInfrastructureNotice } from "@/components/workspace/projects-workspace";
import { ProjectInfrastructureError, projectInfrastructureStatus, verifyProjectRuntime } from "@/domains/projects-workflow/runtime";

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  const configuration = projectInfrastructureStatus();
  if (!configuration.ready) return <ProjectInfrastructureNotice issues={configuration.issues} />;

  try {
    await verifyProjectRuntime(await headers());
  } catch (error) {
    const issues = error instanceof ProjectInfrastructureError ? error.issues : ["Project persistence could not be verified."];
    return <ProjectInfrastructureNotice issues={issues} />;
  }

  const { state } = await searchParams;
  return <ProjectCreateForm state={state} />;
}
