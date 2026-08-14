import { getProjectOverview } from "@/domains/projects-workspace/runtime";

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  try {
    const overview = await getProjectOverview(request.headers.get("cookie"), projectId);
    if (!overview) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    return Response.json({ projectId: overview.project.projectId, name: overview.project.name, clientName: overview.clientName, stage: overview.stageLabel });
  } catch {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }
}
