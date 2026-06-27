// Matching engine. Pure functions, fully working.
//
// Design principle: MISSING DATA IS NOT A PENALTY. Every score function returns
// `null` when it has no data to compare; combineScores() then excludes those
// dimensions from the weighted average (renormalizing the remaining weights)
// instead of treating them as a zero. This lets very sparse cases still match.

import { LANGUAGE_FAMILIES } from "./constants";
import type { Case, GeoPoint } from "./types";

export interface ScoreSet {
  geo: number | null;
  time: number | null;
  demographic: number | null;
  language: number | null;
  // text is only used by the free-text smart search; it is null for case↔case
  // matching and therefore excluded from the weighted average there.
  text?: number | null;
}

export interface Weights {
  geo: number;
  time: number;
  demographic: number;
  language: number;
  text?: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  geo: 0.3,
  time: 0.25,
  demographic: 0.25,
  language: 0.2,
};

export const EXACT_MATCH_THRESHOLD = 90;
export const REVIEW_THRESHOLD = 40;

// ---------------------------------------------------------------------------
// Geo
// ---------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * 100 when the two locations are within ~1km, decaying smoothly to ~0 by ~12km.
 * Returns null when either case has no location.
 */
export function geoScore(caseA: Case, caseB: Case): number | null {
  if (!caseA.location || !caseB.location) return null;
  const km = haversineDistanceKm(caseA.location, caseB.location);
  if (km <= 1) return 100;
  // Exponential decay: at ~3km ~70, ~6km ~45, ~12km ~12.
  const score = 100 * Math.exp(-(km - 1) / 6);
  return Math.max(0, Math.round(score));
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/**
 * 100 when reported within an hour of each other, decaying with hours apart.
 * Returns null if either timestamp is missing/invalid.
 */
export function timeScore(caseA: Case, caseB: Case): number | null {
  const ta = Date.parse(caseA.timeReported);
  const tb = Date.parse(caseB.timeReported);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  const hours = Math.abs(ta - tb) / (1000 * 60 * 60);
  if (hours <= 1) return 100;
  // Decay: ~6h ~58, ~12h ~33, ~24h ~11, ~48h ~1.
  const score = 100 * Math.exp(-(hours - 1) / 11);
  return Math.max(0, Math.round(score));
}

// ---------------------------------------------------------------------------
// Demographics
// ---------------------------------------------------------------------------

function isUnknown(v: string | null | undefined): boolean {
  return !v || v.trim() === "" || v.toLowerCase() === "unknown";
}

// Adjacency of age buckets so neighbouring ranges get partial credit.
// Matches the dataset's age_band values.
const AGE_ORDER = ["0-12", "13-17", "18-40", "41-60", "61-70", "71-80", "80+"];

function ageComponent(a: string | null, b: string | null): number | null {
  if (isUnknown(a) || isUnknown(b)) return null; // no data → exclude
  if (a === b) return 100;
  const ia = AGE_ORDER.indexOf(a as string);
  const ib = AGE_ORDER.indexOf(b as string);
  if (ia === -1 || ib === -1) return 0;
  const dist = Math.abs(ia - ib);
  if (dist === 1) return 60; // adjacent bucket
  if (dist === 2) return 25;
  return 0;
}

function genderComponent(a: string | null, b: string | null): number | null {
  if (isUnknown(a) || isUnknown(b)) return null; // no data → exclude
  return a === b ? 100 : 0;
}

/**
 * Compares ageRange + gender. Unknown fields get partial credit (they are
 * dropped from the sub-average) rather than zeroing the whole demographic match.
 * Returns null only if BOTH age and gender are unknown on either side.
 */
export function demographicScore(caseA: Case, caseB: Case): number | null {
  const age = ageComponent(caseA.ageRange, caseB.ageRange);
  const gender = genderComponent(caseA.gender, caseB.gender);
  const parts = [age, gender].filter((p): p is number => p !== null);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((s, p) => s + p, 0) / parts.length);
}

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

/**
 * Exact language = 100, same language family = 50, different family = 0,
 * unknown (either side) = null (neutral, not penalized).
 */
export function languageScore(caseA: Case, caseB: Case): number | null {
  if (isUnknown(caseA.language) || isUnknown(caseB.language)) return null;
  const a = caseA.language as string;
  const b = caseB.language as string;
  if (a.toLowerCase() === b.toLowerCase()) return 100;
  const famA = LANGUAGE_FAMILIES[a];
  const famB = LANGUAGE_FAMILIES[b];
  if (famA && famB && famA === famB) return 50;
  return 0;
}

// ---------------------------------------------------------------------------
// Combine
// ---------------------------------------------------------------------------

/**
 * Weighted average over only the non-null score dimensions. The weights of the
 * present dimensions are renormalized so missing data neither helps nor hurts.
 * Returns 0 if there is nothing at all to compare.
 */
export function combineScores(weights: Weights, scores: ScoreSet): number {
  const dims: Array<keyof ScoreSet & keyof Weights> = [
    "geo",
    "time",
    "demographic",
    "language",
    "text",
  ];
  let weightSum = 0;
  let weighted = 0;
  for (const dim of dims) {
    const value = scores[dim];
    const weight = weights[dim];
    if (value === null || value === undefined || weight === undefined) continue;
    weightSum += weight;
    weighted += weight * value;
  }
  if (weightSum === 0) return 0;
  return Math.round(weighted / weightSum);
}

// ---------------------------------------------------------------------------
// Explanation
// ---------------------------------------------------------------------------

/** Human-readable bullets used directly in the UI. */
export function matchExplanation(
  caseA: Case,
  caseB: Case,
  scores: ScoreSet
): string[] {
  const out: string[] = [];

  // Geo
  if (scores.geo !== null && scores.geo !== undefined) {
    if (caseA.location && caseB.location) {
      const km = haversineDistanceKm(caseA.location, caseB.location);
      if (scores.geo >= 80) {
        out.push(`✓ Very close locations (~${km.toFixed(1)} km apart)`);
      } else if (scores.geo >= 40) {
        out.push(`~ Nearby locations (~${km.toFixed(1)} km apart)`);
      } else {
        out.push(`✗ Locations far apart (~${km.toFixed(1)} km)`);
      }
    }
  } else {
    out.push("• Location unknown on one side (not scored)");
  }

  // Time
  if (scores.time !== null && scores.time !== undefined) {
    const hrs =
      Math.abs(Date.parse(caseA.timeReported) - Date.parse(caseB.timeReported)) /
      36e5;
    if (scores.time >= 80) {
      out.push(`✓ Reported close in time (~${hrs.toFixed(1)} h apart)`);
    } else if (scores.time >= 40) {
      out.push(`~ Reported within the same window (~${hrs.toFixed(1)} h apart)`);
    } else {
      out.push(`✗ Reported far apart in time (~${hrs.toFixed(1)} h)`);
    }
  }

  // Demographics
  if (scores.demographic !== null && scores.demographic !== undefined) {
    if (!isUnknown(caseA.ageRange) && caseA.ageRange === caseB.ageRange) {
      out.push(`✓ Same age range (${caseA.ageRange})`);
    } else if (scores.demographic >= 40) {
      out.push("~ Similar age range");
    }
    if (
      !isUnknown(caseA.gender) &&
      caseA.gender === caseB.gender
    ) {
      out.push(`✓ Same gender (${caseA.gender})`);
    }
  } else {
    out.push("• Demographics unknown (not scored)");
  }

  // Language
  if (scores.language !== null && scores.language !== undefined) {
    if (scores.language === 100) {
      out.push(`✓ Same language (${caseA.language})`);
    } else if (scores.language === 50) {
      out.push(
        `~ Related language family (${caseA.language} / ${caseB.language})`
      );
    } else {
      out.push(`✗ Different language (${caseA.language} vs ${caseB.language})`);
    }
  } else {
    out.push("• Language unknown (not scored)");
  }

  // Region (informational, not a scored dimension)
  if (!isUnknown(caseA.region) && caseA.region === caseB.region) {
    out.push(`✓ Same home region (${caseA.region})`);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Candidate finding
// ---------------------------------------------------------------------------

export interface Candidate {
  caseId: string;
  case: Case;
  score: number;
  breakdown: string[];
  scores: ScoreSet;
}

/**
 * Scores a new case against all open cases and returns ranked candidates with
 * score >= REVIEW_THRESHOLD, sorted high → low. Never throws on missing data.
 */
export function findCandidates(newCase: Case, allOpenCases: Case[]): Candidate[] {
  const candidates: Candidate[] = [];
  for (const other of allOpenCases) {
    if (other.id === newCase.id) continue;
    const scores: ScoreSet = {
      geo: geoScore(newCase, other),
      time: timeScore(newCase, other),
      demographic: demographicScore(newCase, other),
      language: languageScore(newCase, other),
    };
    const score = combineScores(DEFAULT_WEIGHTS, scores);
    if (score < REVIEW_THRESHOLD) continue;
    candidates.push({
      caseId: other.id,
      case: other,
      score,
      breakdown: matchExplanation(newCase, other, scores),
      scores,
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}
