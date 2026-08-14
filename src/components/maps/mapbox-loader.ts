const MAPBOX_GL_VERSION = "v3.25.0";
const MAPBOX_SCRIPT_ID = "accelssa-mapbox-gl-script";
const MAPBOX_STYLE_ID = "accelssa-mapbox-gl-style";

export interface MapboxEvent {
  lngLat?: { lng: number; lat: number };
  point?: unknown;
  features?: Array<{ properties?: Record<string, unknown> }>;
}

export interface MapboxGeoJsonSource {
  setData(data: unknown): void;
}

export interface MapboxMap {
  addControl(control: unknown, position?: string): void;
  addSource(id: string, source: Record<string, unknown>): void;
  getSource(id: string): MapboxGeoJsonSource | undefined;
  addLayer(layer: Record<string, unknown>): void;
  getLayer(id: string): unknown;
  setLayoutProperty(layerId: string, name: string, value: unknown): void;
  on(event: string, handler: (event: MapboxEvent) => void): MapboxMap;
  on(event: string, layerId: string, handler: (event: MapboxEvent) => void): MapboxMap;
  queryRenderedFeatures(point: unknown, options?: { layers?: string[] }): Array<{ properties?: Record<string, unknown> }>;
  flyTo(options: { center: [number, number]; zoom?: number; essential?: boolean }): void;
  fitBounds(bounds: [[number, number], [number, number]], options?: Record<string, unknown>): void;
  resize(): void;
  remove(): void;
  getCanvas(): HTMLCanvasElement;
}

export interface MapboxNamespace {
  accessToken: string;
  Map: new (options: Record<string, unknown>) => MapboxMap;
  NavigationControl: new (options?: Record<string, unknown>) => unknown;
}

declare global {
  interface Window {
    mapboxgl?: MapboxNamespace;
  }
}

let loaderPromise: Promise<MapboxNamespace> | null = null;

export function loadMapboxGl(): Promise<MapboxNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mapbox GL JS can only be loaded in the browser"));
  }
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<MapboxNamespace>((resolve, reject) => {
    if (!document.getElementById(MAPBOX_STYLE_ID)) {
      const link = document.createElement("link");
      link.id = MAPBOX_STYLE_ID;
      link.rel = "stylesheet";
      link.href = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.css`;
      document.head.appendChild(link);
    }

    const existing = document.getElementById(MAPBOX_SCRIPT_ID) as HTMLScriptElement | null;
    const finish = () => {
      if (window.mapboxgl) resolve(window.mapboxgl);
      else reject(new Error("Mapbox GL JS loaded without exposing mapboxgl"));
    };

    if (existing) {
      if (window.mapboxgl) finish();
      else {
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener("error", () => reject(new Error("Unable to load Mapbox GL JS")), { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.id = MAPBOX_SCRIPT_ID;
    script.src = `https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.js`;
    script.async = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("Unable to load Mapbox GL JS")), { once: true });
    document.head.appendChild(script);
  });

  return loaderPromise;
}
