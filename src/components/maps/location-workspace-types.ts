import type { Project } from "../../../domains/projects-workflow/src/types";
import type { Candidate } from "../../../packages/decision-analytics/src/types";
import type { Geography } from "../../../packages/gis/src/domain/geography";
import type { Geometry } from "../../../packages/gis/src/types/geojson";

/**
 * A read-only map projection over canonical project, candidate and geography records.
 * It intentionally does not create a parallel map-specific candidate model.
 */
export type LocationProjectContext = Pick<
  Project,
  "projectId" | "tenantId" | "name" | "stageCode" | "targetGeographies"
>;

export interface CandidateGeographyOverlay {
  candidate: Pick<Candidate, "id" | "tenantId" | "projectId" | "kind" | "name">;
  geographyId: Geography["geographyId"];
  geometry: Geometry;
}

export interface LocationWorkspaceProps {
  mapboxToken: string | null;
  requestedProjectId?: string;
  project: LocationProjectContext | null;
  geographies: Geography[];
  candidates: CandidateGeographyOverlay[];
}
