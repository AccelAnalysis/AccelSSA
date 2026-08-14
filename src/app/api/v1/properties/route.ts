import type {
  PropertyAvailabilityStatus,
  PropertyDraft,
  PropertyType,
} from "../../../../../packages/properties/src/domain/property";
import type { ReadinessSummary } from "../../../../../packages/properties/src/domain/readiness";
import type { VerificationStatus } from "../../../../../packages/properties/src/domain/verification";
import type { PropertyRegistryFilters } from "@/domains/properties-live/contracts";
import { livePropertyRuntime, propertyRuntimeErrorResponse } from "@/domains/properties-live/runtime";

const propertyTypes = new Set<PropertyType>([
  "INDUSTRIAL_LAND", "INDUSTRIAL_BUILDING", "OFFICE", "WAREHOUSE", "RETAIL", "DATA_CENTER_SITE", "MIXED_USE", "CUSTOM",
]);
const availabilityStatuses = new Set<PropertyAvailabilityStatus>([
  "AVAILABLE", "PARTIALLY_AVAILABLE", "UNDER_OPTION", "UNDER_CONTRACT", "UNAVAILABLE", "UNKNOWN",
]);
const readinessStates = new Set<ReadinessSummary["overallState"]>(["UNKNOWN", "NOT_READY", "CONDITIONAL", "READY"]);
const verificationStatuses = new Set<VerificationStatus>([
  "UNVERIFIED", "SELF_REPORTED", "DOCUMENT_VERIFIED", "CONSULTANT_VERIFIED", "AUTHORITY_VERIFIED", "STALE",
]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters: PropertyRegistryFilters = {};
    const query = url.searchParams.get("q")?.trim();
    const propertyType = url.searchParams.get("propertyType") as PropertyType | null;
    const availabilityStatus = url.searchParams.get("availabilityStatus") as PropertyAvailabilityStatus | null;
    const readinessState = url.searchParams.get("readinessState") as ReadinessSummary["overallState"] | null;
    const verificationStatus = url.searchParams.get("verificationStatus") as VerificationStatus | null;
    const projectId = url.searchParams.get("projectId")?.trim();
    if (query) filters.query = query;
    if (propertyType && propertyTypes.has(propertyType)) filters.propertyType = propertyType;
    if (availabilityStatus && availabilityStatuses.has(availabilityStatus)) filters.availabilityStatus = availabilityStatus;
    if (readinessState && readinessStates.has(readinessState)) filters.readinessState = readinessState;
    if (verificationStatus && verificationStatuses.has(verificationStatus)) filters.verificationStatus = verificationStatus;
    if (projectId) filters.projectId = projectId;

    const data = await livePropertyRuntime.list(request, filters);
    return Response.json({ ok: true, data, capability: livePropertyRuntime.capability() });
  } catch (error) {
    return propertyRuntimeErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const draft = await request.json() as PropertyDraft;
    const data = await livePropertyRuntime.create(request, draft);
    return Response.json({ ok: true, data, capability: livePropertyRuntime.capability() }, { status: 201 });
  } catch (error) {
    return propertyRuntimeErrorResponse(error);
  }
}
