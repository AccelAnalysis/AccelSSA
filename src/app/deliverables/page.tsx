import { headers } from "next/headers";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";
import { readProjectContext } from "@/domains/projects-workflow/runtime";

export default async function Page({ searchParams }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;
  const projectContext = projectId ? await readProjectContext(projectId, await headers()).catch(() => undefined) : undefined;
  return <ModulePlaceholder path="/deliverables" projectContext={projectContext} />;
}
