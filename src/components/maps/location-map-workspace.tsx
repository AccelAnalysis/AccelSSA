"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { GEOGRAPHY_TYPES, type GeographyType } from "../../../packages/gis/src/domain/geography";
import {
  validateSpatialAnalysisRequest,
  type DistanceRequest,
  type RadiusRequest,
} from "../../../packages/gis/src/domain/spatial-analysis";
import { createGeodesicCircle, haversineMiles } from "../../../packages/gis/src/geometry";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  PointGeometry,
  PolygonGeometry,
} from "../../../packages/gis/src/types/geojson";
import {
  candidateFeatureCollection,
  filterCandidateOverlays,
  geographyHierarchy,
  geographyIndex,
  overlayBounds,
  type CandidateKindFilter,
  type GeographyTypeFilter,
} from "./location-workspace-model";
import type { CandidateGeographyOverlay, LocationWorkspaceProps } from "./location-workspace-types";
import { loadMapboxGl, type MapboxEvent, type MapboxMap } from "./mapbox-loader";
import styles from "./location-map-workspace.module.css";

const CANDIDATE_SOURCE_ID = "accelssa-candidates";
const ANALYSIS_SOURCE_ID = "accelssa-map-analysis";
const CANDIDATE_LAYER_IDS = ["accelssa-candidate-fill", "accelssa-candidate-line", "accelssa-candidate-point"];

interface SearchResult {
  id: string;
  label: string;
  context: string;
  featureType: string;
  coordinates: [number, number];
}

type MapStatus = "idle" | "loading" | "ready" | "error";
type ViewMode = "split" | "map";
type ActiveTool = "NONE" | "DISTANCE" | "RADIUS";
type OpenPanel = "filters" | "layers" | null;

interface RadiusPreview {
  center: PointGeometry;
  geometry: PolygonGeometry;
  distanceMiles: number;
}

interface MapLayerVisibility {
  markets: boolean;
  properties: boolean;
  search: boolean;
  analysis: boolean;
}

const EMPTY_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] };

function addWorkspaceLayers(map: MapboxMap) {
  if (!map.getSource(CANDIDATE_SOURCE_ID)) {
    map.addSource(CANDIDATE_SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION });
  }
  if (!map.getSource(ANALYSIS_SOURCE_ID)) {
    map.addSource(ANALYSIS_SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION });
  }

  if (!map.getLayer("accelssa-candidate-fill")) {
    map.addLayer({
      id: "accelssa-candidate-fill",
      type: "fill",
      source: CANDIDATE_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "fill-color": ["case", ["==", ["get", "kind"], "property"], "#8a6418", "#2e5eaa"],
        "fill-opacity": ["case", ["==", ["get", "selected"], true], 0.32, 0.16],
      },
    });
  }
  if (!map.getLayer("accelssa-candidate-line")) {
    map.addLayer({
      id: "accelssa-candidate-line",
      type: "line",
      source: CANDIDATE_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: {
        "line-color": ["case", ["==", ["get", "kind"], "property"], "#8a6418", "#2e5eaa"],
        "line-width": ["case", ["==", ["get", "selected"], true], 4, 1.5],
        "line-opacity": 0.95,
      },
    });
  }
  if (!map.getLayer("accelssa-candidate-point")) {
    map.addLayer({
      id: "accelssa-candidate-point",
      type: "circle",
      source: CANDIDATE_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": ["case", ["==", ["get", "kind"], "property"], "#8a6418", "#2e5eaa"],
        "circle-radius": ["case", ["==", ["get", "selected"], true], 10, 7],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": ["case", ["==", ["get", "selected"], true], 3, 1.5],
      },
    });
  }

  if (!map.getLayer("accelssa-radius-fill")) {
    map.addLayer({
      id: "accelssa-radius-fill",
      type: "fill",
      source: ANALYSIS_SOURCE_ID,
      filter: ["==", ["get", "analysisType"], "RADIUS"],
      paint: { "fill-color": "#344054", "fill-opacity": 0.12 },
    });
  }
  if (!map.getLayer("accelssa-radius-line")) {
    map.addLayer({
      id: "accelssa-radius-line",
      type: "line",
      source: ANALYSIS_SOURCE_ID,
      filter: ["==", ["get", "analysisType"], "RADIUS"],
      paint: { "line-color": "#344054", "line-width": 2, "line-dasharray": [3, 2] },
    });
  }
  if (!map.getLayer("accelssa-distance-line")) {
    map.addLayer({
      id: "accelssa-distance-line",
      type: "line",
      source: ANALYSIS_SOURCE_ID,
      filter: ["==", ["get", "analysisType"], "DISTANCE"],
      paint: { "line-color": "#b54708", "line-width": 3, "line-dasharray": [2, 1] },
    });
  }
  if (!map.getLayer("accelssa-analysis-points")) {
    map.addLayer({
      id: "accelssa-analysis-points",
      type: "circle",
      source: ANALYSIS_SOURCE_ID,
      filter: ["in", ["get", "analysisType"], ["literal", ["SEARCH", "MEASURE_POINT", "RADIUS_CENTER"]]],
      paint: {
        "circle-color": ["case", ["==", ["get", "analysisType"], "SEARCH"], "#111827", "#b54708"],
        "circle-radius": ["case", ["==", ["get", "analysisType"], "SEARCH"], 7, 5],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }
}

function asSearchResult(feature: unknown): SearchResult | null {
  if (!feature || typeof feature !== "object") return null;
  const record = feature as Record<string, unknown>;
  const geometry = record.geometry;
  const properties = record.properties;
  if (!geometry || typeof geometry !== "object" || !properties || typeof properties !== "object") return null;

  const geometryRecord = geometry as Record<string, unknown>;
  if (geometryRecord.type !== "Point" || !Array.isArray(geometryRecord.coordinates)) return null;
  const [longitude, latitude] = geometryRecord.coordinates;
  if (typeof longitude !== "number" || typeof latitude !== "number") return null;

  const propertyRecord = properties as Record<string, unknown>;
  const id = [propertyRecord.mapbox_id, record.id].find((value) => typeof value === "string") as string | undefined;
  const name = [propertyRecord.full_address, propertyRecord.name, propertyRecord.name_preferred]
    .find((value) => typeof value === "string") as string | undefined;
  if (!id || !name) return null;

  return {
    id,
    label: name,
    context: typeof propertyRecord.place_formatted === "string" ? propertyRecord.place_formatted : "",
    featureType: typeof propertyRecord.feature_type === "string" ? propertyRecord.feature_type : "location",
    coordinates: [longitude, latitude],
  };
}

function analysisCollection(
  searchFocus: SearchResult | null,
  distancePoints: PointGeometry[],
  radiusPreview: RadiusPreview | null,
  visibility: MapLayerVisibility,
): FeatureCollection {
  const features: Feature[] = [];

  if (visibility.search && searchFocus) {
    features.push({
      type: "Feature",
      id: `search-${searchFocus.id}`,
      geometry: { type: "Point", coordinates: searchFocus.coordinates },
      properties: { analysisType: "SEARCH", label: searchFocus.label },
    });
  }

  if (visibility.analysis) {
    distancePoints.forEach((point, index) => {
      features.push({
        type: "Feature",
        id: `measure-point-${index}`,
        geometry: point,
        properties: { analysisType: "MEASURE_POINT" },
      });
    });
    if (distancePoints.length === 2) {
      features.push({
        type: "Feature",
        id: "measure-distance-line",
        geometry: {
          type: "LineString",
          coordinates: [distancePoints[0].coordinates, distancePoints[1].coordinates],
        },
        properties: { analysisType: "DISTANCE" },
      });
    }
    if (radiusPreview) {
      features.push({
        type: "Feature",
        id: "radius-preview",
        geometry: radiusPreview.geometry,
        properties: { analysisType: "RADIUS", distanceMiles: radiusPreview.distanceMiles },
      });
      features.push({
        type: "Feature",
        id: "radius-center",
        geometry: radiusPreview.center,
        properties: { analysisType: "RADIUS_CENTER" },
      });
    }
  }

  return { type: "FeatureCollection", features };
}

function geometryLabel(geometry: Geometry) {
  return geometry.type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function geographyTypeLabel(type: GeographyType) {
  return type.replaceAll("_", " ").toLocaleLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LocationMapWorkspace({
  mapboxToken,
  requestedProjectId,
  project,
  geographies,
  candidates,
}: LocationWorkspaceProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const mapClickHandlerRef = useRef<(event: MapboxEvent) => void>(() => undefined);
  const [mapStatus, setMapStatus] = useState<MapStatus>(mapboxToken ? "idle" : "error");
  const [mapError, setMapError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchFocus, setSearchFocus] = useState<SearchResult | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<CandidateKindFilter>("all");
  const [geographyTypeFilter, setGeographyTypeFilter] = useState<GeographyTypeFilter>("all");
  const [layers, setLayers] = useState<MapLayerVisibility>({
    markets: true,
    properties: true,
    search: true,
    analysis: true,
  });
  const [activeTool, setActiveTool] = useState<ActiveTool>("NONE");
  const [distancePoints, setDistancePoints] = useState<PointGeometry[]>([]);
  const [distanceResultMiles, setDistanceResultMiles] = useState<number | null>(null);
  const [radiusDistanceMiles, setRadiusDistanceMiles] = useState(10);
  const [radiusPreview, setRadiusPreview] = useState<RadiusPreview | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);

  const activeProjectId = project?.projectId ?? requestedProjectId;
  const projectScopedCandidates = useMemo(
    () => activeProjectId ? candidates.filter((overlay) => overlay.candidate.projectId === activeProjectId) : candidates,
    [activeProjectId, candidates],
  );
  const filteredCandidates = useMemo(
    () => filterCandidateOverlays(projectScopedCandidates, geographies, searchQuery, kindFilter, geographyTypeFilter),
    [projectScopedCandidates, geographies, searchQuery, kindFilter, geographyTypeFilter],
  );
  const mapCandidates = useMemo(
    () => filteredCandidates.filter((overlay) =>
      (overlay.candidate.kind === "market" && layers.markets)
      || (overlay.candidate.kind === "property" && layers.properties)),
    [filteredCandidates, layers.markets, layers.properties],
  );
  const geographyById = useMemo(() => geographyIndex(geographies), [geographies]);
  const selectedOverlay = useMemo(
    () => projectScopedCandidates.find((overlay) => overlay.candidate.id === selectedCandidateId) ?? null,
    [projectScopedCandidates, selectedCandidateId],
  );
  const selectedGeography = selectedOverlay ? geographyById.get(selectedOverlay.geographyId) ?? null : null;
  const selectedHierarchy = useMemo(
    () => selectedGeography ? geographyHierarchy(selectedGeography.geographyId, geographies) : [],
    [selectedGeography, geographies],
  );

  const candidateGeoJson = useMemo(
    () => candidateFeatureCollection(mapCandidates, geographies, selectedCandidateId),
    [mapCandidates, geographies, selectedCandidateId],
  );
  const analysisGeoJson = useMemo(
    () => analysisCollection(searchFocus, distancePoints, radiusPreview, layers),
    [searchFocus, distancePoints, radiusPreview, layers],
  );

  function zoomToOverlay(overlay: CandidateGeographyOverlay) {
    const map = mapRef.current;
    if (!map) return;
    if (overlay.geometry.type === "Point") {
      map.flyTo({ center: [overlay.geometry.coordinates[0], overlay.geometry.coordinates[1]], zoom: 11, essential: true });
      return;
    }
    const bounds = overlayBounds(overlay);
    map.fitBounds([[bounds.west, bounds.south], [bounds.east, bounds.north]], {
      padding: { top: 70, right: selectedCandidateId ? 390 : 70, bottom: 70, left: 70 },
      maxZoom: 13,
      duration: 650,
    });
  }

  function selectCandidate(candidateId: string) {
    const overlay = projectScopedCandidates.find((candidate) => candidate.candidate.id === candidateId);
    if (!overlay) return;
    setSelectedCandidateId(candidateId);
    zoomToOverlay(overlay);
  }

  function clearAnalysis() {
    setActiveTool("NONE");
    setDistancePoints([]);
    setDistanceResultMiles(null);
    setRadiusPreview(null);
    setAnalysisStatus(null);
  }

  function beginDistance() {
    setActiveTool("DISTANCE");
    setDistancePoints([]);
    setDistanceResultMiles(null);
    setAnalysisStatus("Select the first point on the map.");
  }

  function beginRadius() {
    if (!Number.isFinite(radiusDistanceMiles) || radiusDistanceMiles <= 0) {
      setAnalysisStatus("Enter a radius greater than zero.");
      return;
    }
    setActiveTool("RADIUS");
    setAnalysisStatus("Select the radius center on the map.");
  }

  mapClickHandlerRef.current = (event) => {
    const map = mapRef.current;
    if (!map || !event.lngLat) return;

    if (activeTool === "NONE" && event.point !== undefined) {
      const clickableLayers = CANDIDATE_LAYER_IDS.filter((layerId) => Boolean(map.getLayer(layerId)));
      const rendered = clickableLayers.length
        ? map.queryRenderedFeatures(event.point, { layers: clickableLayers })
        : [];
      const candidateId = rendered
        .map((feature) => feature.properties?.candidateId)
        .find((value) => typeof value === "string");
      if (typeof candidateId === "string") {
        selectCandidate(candidateId);
      }
      return;
    }

    const point: PointGeometry = { type: "Point", coordinates: [event.lngLat.lng, event.lngLat.lat] };
    if (activeTool === "DISTANCE") {
      if (distancePoints.length === 0) {
        setDistancePoints([point]);
        setAnalysisStatus("Select the second point on the map.");
        return;
      }

      const origin = distancePoints[0];
      const request: DistanceRequest = {
        type: "DISTANCE",
        origin: { kind: "CUSTOM_POINT", id: "workspace-measure-origin" },
        destination: { kind: "CUSTOM_POINT", id: "workspace-measure-destination" },
        mode: "GEODESIC",
        unit: "MILES",
      };
      validateSpatialAnalysisRequest(request);
      const result = haversineMiles(origin, point);
      setDistancePoints([origin, point]);
      setDistanceResultMiles(result);
      setActiveTool("NONE");
      setAnalysisStatus(`Geodesic distance: ${result.toLocaleString(undefined, { maximumFractionDigits: 2 })} mi.`);
      return;
    }

    if (activeTool === "RADIUS") {
      const request: RadiusRequest = {
        type: "RADIUS",
        origin: { kind: "CUSTOM_POINT", id: "workspace-radius-center" },
        distance: radiusDistanceMiles,
        unit: "MILES",
      };
      validateSpatialAnalysisRequest(request);
      const geometry = createGeodesicCircle(point, radiusDistanceMiles, "MILES");
      setRadiusPreview({ center: point, geometry, distanceMiles: radiusDistanceMiles });
      setActiveTool("NONE");
      setAnalysisStatus(`Radius preview: ${radiusDistanceMiles.toLocaleString()} mi geodesic buffer.`);
    }
  };

  useEffect(() => {
    if (!mapboxToken || !mapContainerRef.current) return;
    let disposed = false;
    setMapStatus("loading");
    setMapError(null);

    void loadMapboxGl()
      .then((mapboxgl) => {
        if (disposed || !mapContainerRef.current) return;
        mapboxgl.accessToken = mapboxToken;
        const map = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: [-98.5795, 39.8283],
          zoom: 3.2,
          attributionControl: true,
        });
        mapRef.current = map;
        map.addControl(new mapboxgl.NavigationControl({ showCompass: true, showZoom: true }), "top-right");
        map.on("load", () => {
          if (disposed) return;
          addWorkspaceLayers(map);
          setMapStatus("ready");
          map.resize();
        });
        map.on("click", (event) => mapClickHandlerRef.current(event));
      })
      .catch((error: unknown) => {
        if (disposed) return;
        setMapStatus("error");
        setMapError(error instanceof Error ? error.message : "Unable to initialize the map");
      });

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  useEffect(() => {
    if (mapStatus !== "ready") return;
    mapRef.current?.getSource(CANDIDATE_SOURCE_ID)?.setData(candidateGeoJson);
  }, [candidateGeoJson, mapStatus]);

  useEffect(() => {
    if (mapStatus !== "ready") return;
    mapRef.current?.getSource(ANALYSIS_SOURCE_ID)?.setData(analysisGeoJson);
  }, [analysisGeoJson, mapStatus]);

  useEffect(() => {
    if (mapStatus !== "ready") return;
    const timer = window.setTimeout(() => mapRef.current?.resize(), 0);
    return () => window.clearTimeout(timer);
  }, [viewMode, selectedCandidateId, mapStatus]);

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query || !mapboxToken) return;
    setSearchBusy(true);
    setSearchError(null);

    try {
      const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "6");
      url.searchParams.set("autocomplete", "false");
      url.searchParams.set("access_token", mapboxToken);
      const response = await fetch(url.toString(), { method: "GET" });
      if (!response.ok) throw new Error(`Map search failed (${response.status})`);
      const payload = await response.json() as { features?: unknown[] };
      const results = (payload.features ?? []).map(asSearchResult).filter((result): result is SearchResult => Boolean(result));
      setSearchResults(results);
      if (results.length === 0) setSearchError("No matching locations returned.");
    } catch (error: unknown) {
      setSearchResults([]);
      setSearchError(error instanceof Error ? error.message : "Location search is unavailable.");
    } finally {
      setSearchBusy(false);
    }
  }

  function focusSearchResult(result: SearchResult) {
    setSearchFocus(result);
    mapRef.current?.flyTo({ center: result.coordinates, zoom: result.featureType === "address" ? 14 : 9, essential: true });
  }

  const projectDisplay = project?.name ?? requestedProjectId ?? "No project selected";
  const projectMeta = project?.stageCode ?? (requestedProjectId ? "Project record unavailable" : null);
  const mapReady = mapStatus === "ready";

  return (
    <section className={styles.workspace} aria-label="Locations map workspace">
      <header className={styles.toolbar}>
        <div className={styles.projectContext}>
          <span className={styles.contextLabel}>Project</span>
          <strong title={projectDisplay}>{projectDisplay}</strong>
          {projectMeta ? <span className={styles.contextMeta}>{projectMeta}</span> : <Link href="/projects">Select</Link>}
        </div>

        <form className={styles.searchForm} onSubmit={submitSearch} role="search">
          <input
            className={styles.searchInput}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search candidates or map locations"
            aria-label="Search candidates or map locations"
          />
          <button className={styles.searchButton} type="submit" disabled={!mapboxToken || !searchQuery.trim() || searchBusy}>
            {searchBusy ? "Searching" : "Search map"}
          </button>
        </form>

        <div className={styles.toolbarActions}>
          <button
            className={styles.toolbarButton}
            type="button"
            aria-pressed={viewMode === "split"}
            onClick={() => setViewMode((current) => current === "split" ? "map" : "split")}
          >
            {viewMode === "split" ? "Map only" : "Map + list"}
          </button>
          <button
            className={styles.toolbarButton}
            type="button"
            aria-pressed={openPanel === "filters"}
            onClick={() => setOpenPanel((current) => current === "filters" ? null : "filters")}
          >
            Filters
          </button>
          <button
            className={styles.toolbarButton}
            type="button"
            aria-pressed={openPanel === "layers"}
            onClick={() => setOpenPanel((current) => current === "layers" ? null : "layers")}
          >
            Layers
          </button>
        </div>
      </header>

      <div className={`${styles.body} ${viewMode === "map" ? styles.bodyMapOnly : ""}`}>
        <aside className={styles.listPane} aria-label="Location results and candidates">
          {searchResults.length > 0 || searchError ? (
            <div className={styles.listSection}>
              <div className={styles.sectionHeading}>
                <h2>Map search</h2>
                <span className={styles.count}>{searchResults.length}</span>
              </div>
              {searchError ? <p className={styles.searchError}>{searchError}</p> : null}
              <div className={styles.resultList}>
                {searchResults.map((result) => (
                  <button className={styles.searchResultButton} type="button" key={result.id} onClick={() => focusSearchResult(result)}>
                    <span className={styles.resultTitle}>{result.label}</span>
                    <span className={styles.resultMeta}>{result.featureType}{result.context ? ` · ${result.context}` : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.listSection}>
            <div className={styles.sectionHeading}>
              <h2>Candidate geographies</h2>
              <span className={styles.count}>{filteredCandidates.length}</span>
            </div>
            {filteredCandidates.length === 0 ? (
              <p className={styles.emptyList}>
                {activeProjectId
                  ? "No authoritative candidate geographies are available in this project context."
                  : "Select a project to show candidate geographies and property overlays."}
              </p>
            ) : (
              <div className={styles.candidateList}>
                {filteredCandidates.map((overlay) => {
                  const geography = geographyById.get(overlay.geographyId);
                  return (
                    <button
                      className={`${styles.candidateButton} ${selectedCandidateId === overlay.candidate.id ? styles.candidateButtonSelected : ""}`}
                      type="button"
                      key={overlay.candidate.id}
                      onClick={() => selectCandidate(overlay.candidate.id)}
                    >
                      <span className={styles.candidateTitle}>{overlay.candidate.name}</span>
                      <span className={styles.candidateMeta}>
                        {overlay.candidate.kind}{geography ? ` · ${geographyTypeLabel(geography.geographyType)} · ${geography.displayName}` : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <div className={styles.mapStage}>
          {mapboxToken ? <div ref={mapContainerRef} className={styles.mapCanvas} aria-label="Interactive AccelSSA map" /> : null}

          {!mapboxToken ? (
            <div className={styles.configState} role="status">
              <div className={styles.configInner}>
                <strong>Map configuration required</strong>
                <p>Set the public Mapbox token in the build environment, then rebuild or redeploy AccelSSA.</p>
                <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>
              </div>
            </div>
          ) : null}

          {mapboxToken && mapStatus === "loading" ? <div className={styles.mapLoading}>Loading map…</div> : null}
          {mapboxToken && mapStatus === "error" ? (
            <div className={styles.configState} role="alert">
              <div className={styles.configInner}>
                <strong>Map could not initialize</strong>
                <p>{mapError ?? "Verify the Mapbox public token and network access."}</p>
                <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code>
              </div>
            </div>
          ) : null}

          {mapReady ? (
            <div className={styles.spatialTools} aria-label="Spatial analysis tools">
              <button className={styles.toolButton} type="button" aria-pressed={activeTool === "DISTANCE"} onClick={beginDistance}>
                Measure distance
              </button>
              <button className={styles.toolButton} type="button" aria-pressed={activeTool === "RADIUS"} onClick={beginRadius}>
                Radius
              </button>
              <div className={styles.radiusControl}>
                <input
                  className={styles.radiusInput}
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={radiusDistanceMiles}
                  onChange={(event) => setRadiusDistanceMiles(Number(event.target.value))}
                  aria-label="Radius distance in miles"
                />
                <span className={styles.radiusUnit}>mi</span>
              </div>
              <button className={styles.toolButton} type="button" onClick={clearAnalysis} disabled={!distancePoints.length && !radiusPreview && !analysisStatus}>
                Clear
              </button>
            </div>
          ) : null}

          {analysisStatus ? (
            <div className={styles.analysisStatus} role="status">
              {analysisStatus}
              {distanceResultMiles !== null ? ` Exact display: ${distanceResultMiles.toFixed(2)} mi.` : ""}
            </div>
          ) : null}

          {openPanel === "filters" ? (
            <div className={styles.floatingPanel}>
              <div className={styles.panelHeader}>
                <strong>Candidate filters</strong>
                <button className={styles.closeButton} type="button" aria-label="Close filters" onClick={() => setOpenPanel(null)}>×</button>
              </div>
              <div className={styles.panelBody}>
                <label className={styles.fieldLabel}>
                  Candidate type
                  <select className={styles.select} value={kindFilter} onChange={(event) => setKindFilter(event.target.value as CandidateKindFilter)}>
                    <option value="all">All candidates</option>
                    <option value="market">Markets</option>
                    <option value="property">Properties</option>
                  </select>
                </label>
                <label className={styles.fieldLabel}>
                  Geography level
                  <select className={styles.select} value={geographyTypeFilter} onChange={(event) => setGeographyTypeFilter(event.target.value as GeographyTypeFilter)}>
                    <option value="all">All levels</option>
                    {GEOGRAPHY_TYPES.map((type) => <option value={type} key={type}>{geographyTypeLabel(type)}</option>)}
                  </select>
                </label>
              </div>
            </div>
          ) : null}

          {openPanel === "layers" ? (
            <div className={styles.floatingPanel}>
              <div className={styles.panelHeader}>
                <strong>Map layers</strong>
                <button className={styles.closeButton} type="button" aria-label="Close layers" onClick={() => setOpenPanel(null)}>×</button>
              </div>
              <div className={styles.panelBody}>
                {([
                  ["markets", "Candidate markets"],
                  ["properties", "Property candidates"],
                  ["search", "Search location"],
                  ["analysis", "Distance / radius analysis"],
                ] as const).map(([key, label]) => (
                  <label className={styles.checkboxRow} key={key}>
                    <input
                      type="checkbox"
                      checked={layers[key]}
                      onChange={(event) => setLayers((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {selectedOverlay && selectedGeography ? (
            <aside className={styles.drawer} aria-label="Selected candidate details">
              <div className={styles.drawerHeader}>
                <div>
                  <span className={styles.drawerEyebrow}>{selectedOverlay.candidate.kind} candidate</span>
                  <h2>{selectedOverlay.candidate.name}</h2>
                </div>
                <button className={styles.closeButton} type="button" aria-label="Close candidate details" onClick={() => setSelectedCandidateId(null)}>×</button>
              </div>
              <div className={styles.drawerBody}>
                <dl className={styles.detailRows}>
                  <div className={styles.detailRow}>
                    <dt>Geography</dt>
                    <dd>{selectedGeography.displayName}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>Level</dt>
                    <dd>{geographyTypeLabel(selectedGeography.geographyType)}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>Hierarchy</dt>
                    <dd className={styles.hierarchy}>
                      {selectedHierarchy.map((item, index) => (
                        <span key={item.geographyId}>
                          {index > 0 ? <span className={styles.hierarchySeparator}> › </span> : null}
                          {item.displayName}
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>Geometry</dt>
                    <dd>{geometryLabel(selectedOverlay.geometry)}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>Scope</dt>
                    <dd>{selectedGeography.scope}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>Candidate ID</dt>
                    <dd>{selectedOverlay.candidate.id}</dd>
                  </div>
                  <div className={styles.detailRow}>
                    <dt>Project ID</dt>
                    <dd>{selectedOverlay.candidate.projectId}</dd>
                  </div>
                </dl>
                <div className={styles.drawerActions}>
                  <button className={styles.toolButton} type="button" onClick={() => zoomToOverlay(selectedOverlay)}>Zoom to</button>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </section>
  );
}
