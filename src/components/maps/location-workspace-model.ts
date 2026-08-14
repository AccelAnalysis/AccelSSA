import { boundingBoxOf } from "../../../packages/gis/src/geometry";
import type { FeatureCollection } from "../../../packages/gis/src/types/geojson";
import type { Geography, GeographyType } from "../../../packages/gis/src/domain/geography";
import type { CandidateGeographyOverlay } from "./location-workspace-types";

export type CandidateKindFilter = "all" | "market" | "property";
export type GeographyTypeFilter = "all" | GeographyType;

export function geographyIndex(geographies: Geography[]): Map<string, Geography> {
  return new Map(geographies.map((geography) => [geography.geographyId, geography]));
}

export function geographyHierarchy(geographyId: string, geographies: Geography[]): Geography[] {
  const index = geographyIndex(geographies);
  const hierarchy: Geography[] = [];
  const visited = new Set<string>();
  let current = index.get(geographyId);

  while (current && !visited.has(current.geographyId)) {
    visited.add(current.geographyId);
    hierarchy.unshift(current);
    current = current.parentGeographyId ? index.get(current.parentGeographyId) : undefined;
  }

  return hierarchy;
}

export function filterCandidateOverlays(
  candidates: CandidateGeographyOverlay[],
  geographies: Geography[],
  query: string,
  kind: CandidateKindFilter,
  geographyType: GeographyTypeFilter,
): CandidateGeographyOverlay[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const index = geographyIndex(geographies);

  return candidates.filter((overlay) => {
    if (kind !== "all" && overlay.candidate.kind !== kind) return false;
    const geography = index.get(overlay.geographyId);
    if (geographyType !== "all" && geography?.geographyType !== geographyType) return false;
    if (!normalizedQuery) return true;

    return [overlay.candidate.name, geography?.displayName, geography?.canonicalName]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function candidateFeatureCollection(
  candidates: CandidateGeographyOverlay[],
  geographies: Geography[],
  selectedCandidateId: string | null,
): FeatureCollection {
  const index = geographyIndex(geographies);
  return {
    type: "FeatureCollection",
    features: candidates.map((overlay) => {
      const geography = index.get(overlay.geographyId);
      return {
        type: "Feature",
        id: overlay.candidate.id,
        geometry: overlay.geometry,
        properties: {
          candidateId: overlay.candidate.id,
          name: overlay.candidate.name,
          kind: overlay.candidate.kind,
          geographyId: overlay.geographyId,
          geographyType: geography?.geographyType ?? null,
          selected: overlay.candidate.id === selectedCandidateId,
        },
      };
    }),
  };
}

export function overlayBounds(overlay: CandidateGeographyOverlay) {
  return boundingBoxOf(overlay.geometry);
}
