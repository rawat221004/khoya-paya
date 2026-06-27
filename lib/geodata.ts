// Loads the Kumbh Mela 2027 geography datasets (police stations, CCTV cameras,
// chokepoints/parking, zones) from the vendored CSVs and exposes lookups used to
// route a case to the nearest help point and report CCTV coverage near a
// location. Server-only (reads from disk); cached after first load.

import path from "node:path";
import fs from "node:fs";
import { parseCsv } from "./csv";
import { haversineDistanceKm } from "./matching";
import type { GeoPoint } from "./types";

export interface NamedPoint {
  name: string;
  lat: number;
  lng: number;
  category?: string;
}

const DATASET_DIR = path.join(process.cwd(), "dataset");

function loadCsv(file: string): Record<string, string>[] {
  const full = path.join(DATASET_DIR, file);
  if (!fs.existsSync(full)) return [];
  return parseCsv(fs.readFileSync(full, "utf8"));
}

const globalForGeo = globalThis as unknown as {
  _kumbhGeo?: {
    police: NamedPoint[];
    cctv: NamedPoint[];
    chokepoints: NamedPoint[];
    zones: NamedPoint[];
  };
};

function load() {
  if (globalForGeo._kumbhGeo) return globalForGeo._kumbhGeo;

  const police = loadCsv("Police_Stations.csv")
    .map((r) => ({
      name: r.station_name,
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const cctv = loadCsv("CCTV_Locations.csv")
    .map((r) => ({
      name: r.camera_id,
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const chokepoints = loadCsv("Chokepoints_Parking.csv")
    .map((r) => ({
      name: r.location_name,
      category: r.category,
      lat: parseFloat(r.latitude),
      lng: parseFloat(r.longitude),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  const zones = loadCsv("Zone_Boundaries.csv")
    .map((r) => ({
      name: r.zone_name,
      lat: parseFloat(r.centroid_lat),
      lng: parseFloat(r.centroid_lng),
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));

  globalForGeo._kumbhGeo = { police, cctv, chokepoints, zones };
  return globalForGeo._kumbhGeo;
}

export function nearestPoliceStation(
  point: GeoPoint
): { station: NamedPoint; km: number } | null {
  const { police } = load();
  let best: { station: NamedPoint; km: number } | null = null;
  for (const s of police) {
    const km = haversineDistanceKm(point, s);
    if (!best || km < best.km) best = { station: s, km };
  }
  return best;
}

export function nearestChokepoint(
  point: GeoPoint
): { point: NamedPoint; km: number } | null {
  const { chokepoints } = load();
  let best: { point: NamedPoint; km: number } | null = null;
  for (const c of chokepoints) {
    const km = haversineDistanceKm(point, c);
    if (!best || km < best.km) best = { point: c, km };
  }
  return best;
}

/** The N nearest CCTV cameras to a point, sorted nearest-first. */
export function nearestCctvCameras(
  point: GeoPoint,
  n = 6
): Array<{ camera: NamedPoint; km: number }> {
  const { cctv } = load();
  return cctv
    .map((camera) => ({ camera, km: haversineDistanceKm(point, camera) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n);
}

/** Number of CCTV cameras within `radiusKm` of a point (coverage indicator). */
export function cctvCoverageNear(point: GeoPoint, radiusKm = 1): number {
  const { cctv } = load();
  let count = 0;
  for (const c of cctv) {
    if (haversineDistanceKm(point, c) <= radiusKm) count++;
  }
  return count;
}

export function geoStats() {
  const g = load();
  return {
    policeStations: g.police.length,
    cctvCameras: g.cctv.length,
    chokepoints: g.chokepoints.length,
    zones: g.zones.length,
  };
}
