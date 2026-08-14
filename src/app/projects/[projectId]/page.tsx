import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/workspace/project-detail";
import { ProjectInfrastructureNotice } from "@/components/workspace/projects-workspace";
import { ProjectInfrastructureError, readProjectDetail } from "@/domains/projects-workflow/runtime";

export default async function ProjectDetailPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<{ state?: string }> }) {
  const [{ projectId }, { state }] = await Promise.all([params, searchParams]);
  try {
    const detail = await readProjectDetail(projectId, await headers());
    if (!detail) notFound();
    return <ProjectDetail detail={detail} state={state} />;
  } catch (error) {
    if (error instanceof ProjectInfrastructureError) return <ProjectInfrastructureNotice issues={error.issues} />;
    throw error;
  }
}
