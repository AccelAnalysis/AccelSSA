import type { ProjectStageDefinition, TenantId } from './types.js';

const stage = (
  tenantId: TenantId,
  code: string,
  displayName: string,
  ordinal: number,
  allowedNextStageCodes: string[],
  isTerminal = false,
): ProjectStageDefinition => ({
  tenantId,
  code,
  displayName,
  ordinal,
  allowedNextStageCodes,
  isTerminal,
});

/**
 * Canonical AccelSSA project lifecycle from the platform definition.
 * Firms can replace this with template-specific stage definitions.
 */
export function defaultProjectStages(tenantId: TenantId): ProjectStageDefinition[] {
  return [
    stage(tenantId, 'INTAKE', 'Intake', 10, ['REQUIREMENTS_DEFINITION']),
    stage(tenantId, 'REQUIREMENTS_DEFINITION', 'Requirements Definition', 20, ['GEOGRAPHIC_SCREENING']),
    stage(tenantId, 'GEOGRAPHIC_SCREENING', 'Geographic Screening', 30, ['MARKET_EVALUATION']),
    stage(tenantId, 'MARKET_EVALUATION', 'Market Evaluation', 40, ['PROPERTY_SCREENING']),
    stage(tenantId, 'PROPERTY_SCREENING', 'Property Screening', 50, ['SHORTLIST']),
    stage(tenantId, 'SHORTLIST', 'Shortlist', 60, ['DUE_DILIGENCE']),
    stage(tenantId, 'DUE_DILIGENCE', 'Due Diligence', 70, ['SITE_VISITS']),
    stage(tenantId, 'SITE_VISITS', 'Site Visits', 80, ['FINALISTS']),
    stage(tenantId, 'FINALISTS', 'Finalists', 90, ['NEGOTIATION']),
    stage(tenantId, 'NEGOTIATION', 'Negotiation', 100, ['RECOMMENDATION']),
    stage(tenantId, 'RECOMMENDATION', 'Recommendation', 110, ['SELECTED']),
    stage(tenantId, 'SELECTED', 'Selected', 120, ['CLOSED']),
    stage(tenantId, 'CLOSED', 'Closed', 130, ['ARCHIVED']),
    stage(tenantId, 'ARCHIVED', 'Archived', 140, [], true),
  ];
}
