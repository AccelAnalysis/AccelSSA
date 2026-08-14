import { METRICS } from "./metricCatalog.js";
import type {
  DerivedObservation,
  EducationAccess,
  EducationPipelineAssessment,
  EducationProgram,
  EmployerAccess,
  EmployerCompetitionAssessment,
  EmployerFacility,
  LaborShedAggregationRequest,
  OccupationRequirement,
  ResolvedObservation,
  TransportationAccess,
  TransportationAssetType,
  TransportationProfile,
  UtilityAvailability,
  UtilityMarketProfile,
  UtilityProvider,
  WorkforceRequirementAssessment
} from "./model.js";
import type { MetricRegistryPort } from "./registry.js";
import { ObservationStore } from "./observationStore.js";

function numeric(resolved: ResolvedObservation): number | undefined {
  if ((resolved.state === "KNOWN" || resolved.state === "ESTIMATED" || resolved.state === "STALE") && typeof resolved.observation?.value === "number") {
    return resolved.observation.value;
  }
  return undefined;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export class LocationIntelligenceAnalysis {
  constructor(
    private readonly registry: MetricRegistryPort,
    private readonly observations: ObservationStore
  ) {}

  aggregateLaborShed(request: LaborShedAggregationRequest): DerivedObservation {
    const definition = this.registry.get(request.metricId);
    if (!definition) throw new Error(`Unknown metric: ${request.metricId}`);
    if (definition.aggregation === "NONE") {
      throw new Error(`Metric ${request.metricId} cannot be aggregated into a labor shed`);
    }

    const asOf = request.asOf ?? new Date().toISOString();
    const resolved = request.components.map((component) => ({
      component,
      observation: this.observations.resolve({
        metricId: request.metricId,
        geographyId: component.geographyId,
        dimensions: request.dimensions,
        tenantId: request.tenantId,
        asOf
      })
    }));

    const blocking = resolved.filter(({ observation }) => !["KNOWN", "ESTIMATED", "STALE"].includes(observation.state));
    if (blocking.length > 0) {
      return {
        id: `derived:${request.laborShed.id}:${request.metricId}:${asOf}`,
        metricId: request.metricId,
        unit: definition.unit,
        geographyId: request.laborShed.id,
        geographyType: "labor_shed",
        dimensions: request.dimensions ?? {},
        availability: blocking.some(({ observation }) => observation.state === "CONFLICTING") ? "CONFLICTING" : "UNKNOWN",
        asOf,
        derivation: {
          method: `LABOR_SHED_${definition.aggregation}`,
          inputObservationIds: resolved.flatMap(({ observation }) => observation.observation ? [observation.observation.id] : []),
          notes: "Aggregation withheld because at least one required component lacks a usable observation."
        }
      };
    }

    const samples = resolved.map(({ component, observation }) => ({
      component,
      observation,
      value: numeric(observation)
    }));

    if (samples.some((sample) => sample.value === undefined)) {
      throw new Error(`Metric ${request.metricId} must be numeric to use ${definition.aggregation} labor-shed aggregation`);
    }

    let value: number;
    if (definition.aggregation === "SUM") {
      value = samples.reduce((total, sample) => total + (sample.value ?? 0) * sample.component.coverageFraction, 0);
    } else if (definition.aggregation === "AVERAGE") {
      value = samples.reduce((total, sample) => total + (sample.value ?? 0), 0) / samples.length;
    } else {
      const weights = samples.map((sample) => sample.component.weight ?? sample.component.coverageFraction);
      const denominator = weights.reduce((total, weight) => total + weight, 0);
      if (denominator <= 0) throw new Error("Weighted labor-shed aggregation requires a positive total weight");
      value = samples.reduce((total, sample, index) => total + (sample.value ?? 0) * (weights[index] ?? 0), 0) / denominator;
    }

    const state = resolved.some(({ observation }) => observation.state === "STALE")
      ? "STALE"
      : resolved.some(({ observation }) => observation.state === "ESTIMATED")
        ? "ESTIMATED"
        : "KNOWN";

    return {
      id: `derived:${request.laborShed.id}:${request.metricId}:${asOf}`,
      metricId: request.metricId,
      value,
      unit: definition.unit,
      geographyId: request.laborShed.id,
      geographyType: "labor_shed",
      dimensions: request.dimensions ?? {},
      availability: state,
      asOf,
      derivation: {
        method: `LABOR_SHED_${definition.aggregation}`,
        inputObservationIds: resolved.flatMap(({ observation }) => observation.observation ? [observation.observation.id] : []),
        notes: "Coverage fractions and weights are supplied by the spatial/data aggregation boundary; Category 6 does not infer population from polygon area."
      }
    };
  }

  assessWorkforce(requirement: OccupationRequirement, laborShedId: string, asOf?: string): WorkforceRequirementAssessment {
    const query = (metricId: string): ResolvedObservation => this.observations.resolve({
      metricId,
      geographyId: laborShedId,
      dimensions: { occupationCode: requirement.occupationCode },
      tenantId: requirement.tenantId,
      asOf
    });

    const employment = query(METRICS.occupationEmployment);
    const medianWage = query(METRICS.occupationMedianWage);
    const wageGrowth = query(METRICS.occupationWageGrowth);
    const jobPostings = query(METRICS.occupationJobPostings);
    const locationQuotient = query(METRICS.occupationLocationQuotient);
    const employmentValue = numeric(employment);
    const wageValue = numeric(medianWage);
    const core = [employment, medianWage, jobPostings, locationQuotient];
    const knownCount = core.filter((item) => ["KNOWN", "ESTIMATED", "STALE"].includes(item.state)).length;
    const warnings: string[] = [];

    for (const item of core) {
      if (item.state === "STALE") warnings.push(`${item.metricId} is stale.`);
      if (item.state === "CONFLICTING") warnings.push(`${item.metricId} has conflicting source observations.`);
      if (["UNKNOWN", "NOT_AVAILABLE_FROM_SOURCE", "SOURCE_UNAVAILABLE"].includes(item.state)) warnings.push(`${item.metricId} is unavailable.`);
    }

    return {
      requirement,
      laborShedId,
      employment,
      medianWage,
      wageGrowth,
      jobPostings,
      locationQuotient,
      ...(employmentValue !== undefined ? { adequacyRatio: employmentValue / requirement.requiredWorkers } : {}),
      ...(wageValue !== undefined && requirement.targetHourlyWage !== undefined ? { wageGapToTarget: wageValue - requirement.targetHourlyWage } : {}),
      evidenceCompleteness: knownCount / core.length,
      warnings
    };
  }

  assessEducationPipeline(
    requirement: OccupationRequirement,
    programs: readonly EducationProgram[],
    access: readonly EducationAccess[],
    maximumDriveMinutes?: number
  ): EducationPipelineAssessment {
    const accessMap = new Map(access.map((item) => [item.institutionId, item]));
    const relevant = programs.filter((program) => {
      if (!program.relatedOccupationCodes.includes(requirement.occupationCode)) return false;
      const institutionAccess = accessMap.get(program.institutionId);
      if (!institutionAccess) return false;
      if (maximumDriveMinutes !== undefined && institutionAccess.driveMinutes !== undefined && institutionAccess.driveMinutes > maximumDriveMinutes) return false;
      return true;
    });
    const annualCompletions = relevant.reduce((total, program) => total + program.annualCompletions, 0);
    return {
      occupationCode: requirement.occupationCode,
      relevantProgramIds: relevant.map((program) => program.id),
      relevantInstitutionIds: unique(relevant.map((program) => program.institutionId)),
      annualCompletions,
      ...(requirement.requiredWorkers > 0 ? { completionsPerRequiredWorker: annualCompletions / requirement.requiredWorkers } : {})
    };
  }

  assessEmployerCompetition(
    occupationCode: string,
    facilities: readonly EmployerFacility[],
    access: readonly EmployerAccess[],
    maximumDriveMinutes?: number
  ): EmployerCompetitionAssessment {
    const accessMap = new Map(access.map((item) => [item.facilityId, item]));
    const relevant = facilities.filter((facility) => {
      if ((facility.occupationDemand?.[occupationCode] ?? 0) <= 0 && (facility.currentOpenings?.[occupationCode] ?? 0) <= 0) return false;
      const facilityAccess = accessMap.get(facility.id);
      if (!facilityAccess) return false;
      if (maximumDriveMinutes !== undefined && facilityAccess.driveMinutes !== undefined && facilityAccess.driveMinutes > maximumDriveMinutes) return false;
      return true;
    });
    const workerCounts = relevant.map((facility) => facility.occupationDemand?.[occupationCode]).filter((value): value is number => typeof value === "number");
    const openings = relevant.map((facility) => facility.currentOpenings?.[occupationCode]).filter((value): value is number => typeof value === "number");
    return {
      occupationCode,
      relevantFacilityIds: relevant.map((facility) => facility.id),
      ...(workerCounts.length > 0 ? { estimatedWorkersEmployed: workerCounts.reduce((a, b) => a + b, 0) } : {}),
      ...(openings.length > 0 ? { knownOpenings: openings.reduce((a, b) => a + b, 0) } : {}),
      expansionPressureCount: relevant.filter((facility) => facility.recentEvent === "EXPANSION" || facility.recentEvent === "NEW_FACILITY").length,
      laborReleaseCount: relevant.filter((facility) => facility.recentEvent === "CLOSURE" || facility.recentEvent === "LAYOFF").length
    };
  }

  buildTransportationProfile(candidateId: string, access: readonly TransportationAccess[]): TransportationProfile {
    const nearest: Partial<Record<TransportationAssetType, TransportationAccess>> = {};
    for (const item of access) {
      const current = nearest[item.asset.type];
      const itemDistance = item.driveMinutes ?? item.distanceMiles ?? Number.POSITIVE_INFINITY;
      const currentDistance = current?.driveMinutes ?? current?.distanceMiles ?? Number.POSITIVE_INFINITY;
      if (!current || itemDistance < currentDistance) nearest[item.asset.type] = item;
    }
    return { candidateId, access: [...access], nearestByType: nearest };
  }

  buildUtilityMarketProfile(input: {
    tenantId: string;
    geographyId: string;
    utilityType: UtilityMarketProfile["utilityType"];
    providers: readonly UtilityProvider[];
    availability: UtilityAvailability;
    rateMetricId?: string;
    capacityMetricId?: string;
    leadTimeMetricId?: string;
    asOf?: string;
    notes?: readonly string[];
  }): UtilityMarketProfile {
    const resolve = (metricId: string | undefined): ResolvedObservation | undefined => metricId ? this.observations.resolve({
      metricId,
      geographyId: input.geographyId,
      tenantId: input.tenantId,
      asOf: input.asOf
    }) : undefined;
    const rate = resolve(input.rateMetricId);
    const capacityIndicator = resolve(input.capacityMetricId);
    const leadTime = resolve(input.leadTimeMetricId);
    return {
      geographyId: input.geographyId,
      utilityType: input.utilityType,
      providerIds: input.providers.filter((provider) => provider.utilityTypes.includes(input.utilityType)).map((provider) => provider.id),
      availability: input.availability,
      ...(rate ? { rate } : {}),
      ...(capacityIndicator ? { capacityIndicator } : {}),
      ...(leadTime ? { leadTime } : {}),
      notes: input.notes ?? []
    };
  }
}
