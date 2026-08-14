import { DecisionAnalyticsEngine, type Candidate } from "../../../packages/decision-analytics/src/index";
import type {
  DecisionCriterionNode,
  RequirementSetVersion,
  ScenarioDefinition,
} from "../../../packages/requirements-engine/src/index";
import { buildAnalyticsScenario } from "./adapter";
import type { AnalysisCandidate, AnalysisWorkspaceBundle } from "./contracts";

const tenantId = "sample-tenant";
const projectId = "sample-manufacturing-project";

const requirementSetVersion: RequirementSetVersion = {
  id: "sample-requirements-v2",
  tenantId,
  projectId,
  requirementSetId: "sample-requirements",
  version: 2,
  state: "ACTIVE",
  createdAt: "2026-08-01T13:00:00Z",
  createdBy: "sample-consultant",
  activatedAt: "2026-08-01T14:00:00Z",
  activatedBy: "sample-consultant",
  changeReason: "Sample version for Category 08 acceptance testing.",
  requirements: [
    {
      id: "req-electric",
      tenantId,
      projectId,
      categoryId: "utilities",
      metricKey: "electric_capacity_mw",
      name: "Electric capacity",
      classification: "MANDATORY",
      operator: "GTE",
      target: { value: 10 },
      unit: "MW",
      geographyLevel: "PROPERTY",
      enabled: true,
    },
    {
      id: "req-acreage",
      tenantId,
      projectId,
      categoryId: "real-estate",
      metricKey: "available_acres",
      name: "Available acreage",
      classification: "MANDATORY",
      operator: "GTE",
      target: { value: 40 },
      unit: "ACRE",
      geographyLevel: "PROPERTY",
      enabled: true,
    },
    {
      id: "req-labor",
      tenantId,
      projectId,
      categoryId: "workforce",
      metricKey: "production_labor",
      name: "Production labor availability",
      classification: "PREFERRED",
      operator: "GTE",
      target: { value: 15000 },
      unit: "COUNT",
      geographyLevel: "LABOR_SHED",
      weight: 0.6,
      normalization: "MIN_MAX",
      enabled: true,
    },
    {
      id: "req-wage",
      tenantId,
      projectId,
      categoryId: "workforce",
      metricKey: "production_wage",
      name: "Production wage",
      classification: "PREFERRED",
      operator: "LTE",
      target: { value: 28 },
      unit: "USD_PER_HOUR",
      geographyLevel: "LABOR_SHED",
      weight: 0.4,
      normalization: "INVERSE_MIN_MAX",
      enabled: true,
    },
    {
      id: "req-interstate",
      tenantId,
      projectId,
      categoryId: "logistics",
      metricKey: "interstate_minutes",
      name: "Interstate drive time",
      classification: "PREFERRED",
      operator: "LTE",
      target: { value: 20 },
      unit: "MINUTE",
      geographyLevel: "PROPERTY",
      weight: 1,
      normalization: "INVERSE_MIN_MAX",
      enabled: true,
    },
    {
      id: "req-electric-rate",
      tenantId,
      projectId,
      categoryId: "utilities",
      metricKey: "electric_rate_index",
      name: "Industrial electric rate index",
      classification: "PREFERRED",
      operator: "LTE",
      target: { value: 100 },
      unit: "COUNT",
      geographyLevel: "PROPERTY",
      weight: 1,
      normalization: "INVERSE_MIN_MAX",
      enabled: true,
    },
  ],
};

const criteria: DecisionCriterionNode[] = [
  {
    id: "workforce",
    tenantId,
    projectId,
    type: "CATEGORY",
    name: "Workforce",
    weight: 0.45,
    displayOrder: 1,
    enabled: true,
  },
  {
    id: "logistics",
    tenantId,
    projectId,
    type: "CATEGORY",
    name: "Logistics",
    weight: 0.3,
    displayOrder: 2,
    enabled: true,
  },
  {
    id: "utilities",
    tenantId,
    projectId,
    type: "CATEGORY",
    name: "Utilities",
    weight: 0.25,
    displayOrder: 3,
    enabled: true,
  },
];

const scenarios: ScenarioDefinition[] = [
  {
    id: "balanced",
    tenantId,
    projectId,
    name: "Balanced",
    description: "Sample balanced decision model.",
    baseRequirementVersionId: requirementSetVersion.id,
    requirementOverrides: [],
    criterionWeightOverrides: {},
    createdAt: "2026-08-01T14:05:00Z",
    createdBy: "sample-consultant",
  },
  {
    id: "workforce-priority",
    tenantId,
    projectId,
    name: "Workforce priority",
    description: "Sample scenario placing greater emphasis on workforce.",
    baseRequirementVersionId: requirementSetVersion.id,
    requirementOverrides: [],
    criterionWeightOverrides: {
      workforce: 0.65,
      logistics: 0.2,
      utilities: 0.15,
    },
    createdAt: "2026-08-01T14:10:00Z",
    createdBy: "sample-consultant",
  },
];

function metric(metricId: string, value: number | null, unit: string, sourceId: string, observationDate: string) {
  return {
    metricId,
    value,
    unit,
    sourceId,
    sourceDataset: "Category 08 acceptance sample",
    observationDate,
    retrievedAt: "2026-08-13T18:00:00Z",
    evidenceIds: [],
  };
}

function candidate(
  id: string,
  name: string,
  values: {
    electric: number | null;
    acres: number | null;
    labor: number | null;
    wage: number | null;
    interstate: number | null;
    rate: number | null;
  },
): AnalysisCandidate {
  return {
    id,
    tenantId,
    projectId,
    kind: "property",
    name,
    metrics: {
      electric_capacity_mw: metric("electric_capacity_mw", values.electric, "MW", "sample:utility-letter", "2026-08-10"),
      available_acres: metric("available_acres", values.acres, "ACRE", "sample:property-record", "2026-08-11"),
      production_labor: metric("production_labor", values.labor, "COUNT", "sample:labor-dataset", "2026-06-30"),
      production_wage: metric("production_wage", values.wage, "USD_PER_HOUR", "sample:labor-dataset", "2026-06-30"),
      interstate_minutes: metric("interstate_minutes", values.interstate, "MINUTE", "sample:gis-analysis", "2026-08-12"),
      electric_rate_index: metric("electric_rate_index", values.rate, "COUNT", "sample:utility-rate", "2026-07-01"),
    },
    decisionContext: {
      risk: null,
      consultantJudgment: null,
      clientDecision: null,
    },
  };
}

const candidates: AnalysisCandidate[] = [
  candidate("site-a", "Site A — River Commerce Park", {
    electric: 15,
    acres: 72,
    labor: 23800,
    wage: 25.4,
    interstate: 12,
    rate: 91,
  }),
  candidate("site-b", "Site B — Piedmont Industrial Center", {
    electric: 12,
    acres: 54,
    labor: 28700,
    wage: 27.8,
    interstate: 18,
    rate: 96,
  }),
  candidate("site-c", "Site C — Coastal Logistics Park", {
    electric: 8,
    acres: 110,
    labor: 19500,
    wage: 24.9,
    interstate: 7,
    rate: 88,
  }),
  candidate("site-d", "Site D — Regional Technology Site", {
    electric: null,
    acres: 48,
    labor: 21500,
    wage: 26.1,
    interstate: 24,
    rate: 94,
  }),
];

function historicalSnapshot() {
  const engine = new DecisionAnalyticsEngine();
  const { scenario, requirements } = buildAnalyticsScenario(requirementSetVersion, criteria, scenarios[0]);
  const previousCandidates = candidates.map((entry): Candidate => ({
    ...entry,
    metrics: { ...entry.metrics },
  }));
  previousCandidates[0] = {
    ...previousCandidates[0],
    metrics: {
      ...previousCandidates[0].metrics,
      production_labor: {
        ...previousCandidates[0].metrics.production_labor!,
        value: 21100,
        sourceId: "sample:prior-labor-dataset",
        observationDate: "2026-03-31",
      },
    },
  };
  const run = engine.runScreening({
    runId: "sample-history-2026-07-15",
    tenantId,
    projectId,
    asOf: "2026-07-15T16:00:00Z",
    requirements,
    scenario,
    candidates: previousCandidates,
  });
  return engine.createDecisionSnapshot(
    "sample-snapshot-1",
    "Sample shortlist review",
    "2026-07-15T16:05:00Z",
    run,
  );
}

export function createSampleAnalysisBundle(): AnalysisWorkspaceBundle {
  return {
    tenantId,
    projectId,
    projectName: "Sample Manufacturing Expansion",
    dataMode: "SAMPLE",
    sourceNotice: "Explicit sample data for Category 08 interface and calculation acceptance. It is not project evidence and must not be used for a client decision.",
    requirementSetVersion,
    criteria,
    scenarios,
    candidates,
    historicalSnapshots: [historicalSnapshot()],
    canPersistOverrides: false,
  };
}
