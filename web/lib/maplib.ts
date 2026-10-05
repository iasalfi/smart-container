/** Loads MapLibre GL JS from a CDN the first time a map is shown, so the app bundle stays small. */
export const MAPLIBRE_VERSION = "5.24.0";
export const MAPLIBRE_JS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
export const MAPLIBRE_CSS = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;
/** OpenFreeMap serves OpenStreetMap vector tiles for free and without a key. Override with NEXT_PUBLIC_MAP_STYLE. */
export const BASEMAP_STYLE = process.env.NEXT_PUBLIC_MAP_STYLE || "https://tiles.openfreemap.org/styles/liberty";
export const BASEMAP_TIMEOUT_MS = 9000;

/** A plain background used when the online basemap cannot load. The routes and trucks are still drawn on it. */
export const OFFLINE_STYLE = { version: 8, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#e9eef6" } }] };

export interface MlEvent { lngLat: { lng: number; lat: number }; point: { x: number; y: number }; features?: { properties: Record<string, unknown> }[]; error?: { message?: string; status?: number } }
export interface MlMarker { setLngLat(c: [number, number]): MlMarker; addTo(m: MlMap): MlMarker; remove(): void; getElement(): HTMLElement; setRotation(d: number): MlMarker }
export interface MlMap {
  on(ev: string, fn: (e: MlEvent) => void): void;
  on(ev: string, layer: string, fn: (e: MlEvent) => void): void;
  once(ev: string, fn: (e: MlEvent) => void): void;
  addSource(id: string, s: object): void;
  getSource(id: string): { setData(d: object): void } | undefined;
  addLayer(l: object): void;
  getLayer(id: string): object | undefined;
  setStyle(s: string | object): void;
  fitBounds(b: [[number, number], [number, number]], o?: object): void;
  easeTo(o: object): void;
  zoomIn(): void;
  zoomOut(): void;
  getZoom(): number;
  getCanvas(): HTMLCanvasElement;
  project(c: [number, number]): { x: number; y: number };
  resize(): void;
  remove(): void;
}
export interface MlLib {
  Map: new (o: object) => MlMap;
  Marker: new (o?: object) => MlMarker;
}
declare global { interface Window { maplibregl?: MlLib; __liveMap?: MlMap } }

let pending: Promise<MlLib> | null = null;

export function loadMapLibre(): Promise<MlLib> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (pending) return pending;
  pending = new Promise<MlLib>((resolve, reject) => {
    if (!document.querySelector("link[data-maplibre]")) {
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = MAPLIBRE_CSS; l.setAttribute("data-maplibre", "1");
      document.head.appendChild(l);
    }
    const s = document.createElement("script");
    s.src = MAPLIBRE_JS; s.async = true;
    s.onload = () => (window.maplibregl ? resolve(window.maplibregl) : reject(new Error("maplibre missing")));
    s.onerror = () => { pending = null; s.remove(); reject(new Error("maplibre failed to load")); };
    document.head.appendChild(s);
  });
  return pending;
}
