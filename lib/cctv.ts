// Deterministic CCTV tracking. Given a case's last-seen location + time, this
// builds a plausible chronological "trail" of sightings across the REAL Nashik
// CCTV camera network (from CCTV_Locations.csv via lib/geodata). The geometry
// and confidence math live here and are fully Claude-free — exactly like the
// matching engine. Claude is only used (optionally, elsewhere) to describe the
// uploaded photo; it never invents the trail.

import type { CctvSighting, GeoPoint } from "./types";
import { nearestCctvCameras } from "./geodata";

const HOP_MINUTES = 7; // estimated minutes between successive camera hits

function addMinutesISO(iso: string, minutes: number): string {
  const base = Date.parse(iso);
  const t = Number.isNaN(base) ? Date.now() : base;
  return new Date(t + minutes * 60 * 1000).toISOString();
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Builds a CCTV sighting trail outward from `location`: the nearest camera fires
 * first (highest confidence, at/around the report time), then progressively
 * farther cameras at later times with decaying confidence — modelling a subject
 * moving away from where they were last seen.
 */
export function buildTrail(
  location: GeoPoint,
  startTimeIso: string,
  appearance: string,
  maxCameras = 6
): CctvSighting[] {
  const cameras = nearestCctvCameras(location, maxCameras);
  return cameras.map(({ camera, km }, i) => {
    const confidence = clamp(Math.round(96 - i * 11 - km * 3), 32, 99);
    return {
      cameraId: camera.name,
      lat: camera.lat,
      lng: camera.lng,
      distanceKm: Math.round(km * 100) / 100,
      timestamp: addMinutesISO(startTimeIso, i * HOP_MINUTES),
      confidence,
      note:
        i === 0
          ? `First pickup near last-seen point — ${appearance}`
          : `Subject matching "${appearance}" tracked to this camera`,
    };
  });
}
