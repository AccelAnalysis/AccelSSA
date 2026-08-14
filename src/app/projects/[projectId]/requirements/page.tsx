import { PageHeader } from "@/components/ui/page-header";
import { RequirementsWorkspace } from "@/components/requirements/requirements-workspace";
import {
  getDefaultRequirementVersion,
  validateWorkspaceRequirementVersion,
} from "@/domains/requirements-workspace/engine";
import { readRequirementsWorkspace } from "@/domains/requirements-workspace/runtime";

interface Props {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectRequirementsPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const query = await searchParams;
  const result = await readRequirementsWorkspace(projectId);
  const requestedVersionId = scalar(query.version);
  const selectedVersion = result.state?.versions.find((version) => version.id === requestedVersionId) ?? (result.state ? getDefaultRequirementVersion(result.state) : undefined);
  const validation = result.state && selectedVersion
    ? validateWorkspaceRequirementVersion(result.state, selectedVersion.id, result.metricRegistry)
    : null;

  return (
    <>
      <PageHeader eyebrow="Project requirements" title="Requirements" description="Define qualification constraints, preferred criteria and the decision structure used by project analysis." />
      <RequirementsWorkspace
        projectId={projectId}
        state={result.state}
        ready={result.ready}
        unavailableReason={result.reason}
        error={scalar(query.error)}
        notice={scalar(query.notice)}
        selectedVersionId={selectedVersion?.id}
        validation={validation}
      />
    </>
  );
}
