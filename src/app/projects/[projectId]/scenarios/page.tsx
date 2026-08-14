import { PageHeader } from "@/components/ui/page-header";
import { ScenariosWorkspace } from "@/components/requirements/scenarios-workspace";
import { validateWorkspaceScenario } from "@/domains/requirements-workspace/engine";
import { readRequirementsWorkspace } from "@/domains/requirements-workspace/runtime";

interface Props {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProjectScenariosPage({ params, searchParams }: Props) {
  const { projectId } = await params;
  const query = await searchParams;
  const result = await readRequirementsWorkspace(projectId);
  const requestedScenarioId = scalar(query.scenario);
  const selectedScenario = result.state?.scenarios.find((scenario) => scenario.id === requestedScenarioId) ?? result.state?.scenarios[0];
  const validation = result.state && selectedScenario
    ? validateWorkspaceScenario(result.state, selectedScenario.id, result.metricRegistry)
    : null;

  return (
    <>
      <PageHeader eyebrow="Project requirements" title="Scenarios" description="Compare decision-policy configurations without changing the underlying requirement-set history." />
      <ScenariosWorkspace
        projectId={projectId}
        state={result.state}
        ready={result.ready}
        unavailableReason={result.reason}
        error={scalar(query.error)}
        notice={scalar(query.notice)}
        selectedScenarioId={selectedScenario?.id}
        validation={validation}
      />
    </>
  );
}
