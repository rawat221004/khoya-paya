// Free-text "smart search" that reuses the matching engine. A query string like
// "white kurta, walking stick, Marathi, near Ramkund" is parsed into a partial
// pseudo-case (extracting language and a known location), then scored against
// every open case using the same geo/demographic/language dimensions PLUS a
// text-overlap dimension over the characteristics.
//
// This module is provider-agnostic: the deterministic parseQuery() is the
// fallback for /api/ai/smart-search, and searchByStructured() lets the Claude
// path feed an already-parsed filter object through the exact same scoring.

import { findLocationByLabel, LOCATIONS } from "./constants";
import { naiveExtract, type StructuredFields } from "./extract";
import {
  Weights,
  ScoreSet,
  combineScores,
  geoScore,
  demographicScore,
  languageScore,
  matchExplanation,
} from "./matching";
import type { Case } from "./types";

// Search weights: text dominates because the query is mostly descriptive.
const SEARCH_WEIGHTS: Weights = {
  geo: 0.2,
  time: 0,
  demographic: 0.15,
  language: 0.2,
  text: 0.45,
};

const STOPWORDS = new Set([
  "the","a","an","near","at","with","and","or","of","in","on","to","is","was",
  "wearing","wore","has","had","seen","missing","person","man","woman","old",
  "year","years","aged","approx","approximately","around","by","from","for",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Builds a partial pseudo-Case from a set of structured fields. */
function pseudoCaseFrom(
  fields: StructuredFields,
  freeText: string
): Case {
  const location =
    (fields.locationHint && findLocationByLabel(fields.locationHint)) ||
    LOCATIONS.find((l) =>
      freeText.toLowerCase().includes(l.label.toLowerCase())
    ) ||
    null;

  return {
    id: "__query__",
    status: "open",
    intakePath: "C_standard",
    role: "other",
    photoUrl: null,
    timeReported: new Date().toISOString(),
    location,
    language: fields.language ?? null,
    region: fields.region ?? null,
    ageRange: fields.ageRange ?? null,
    gender: fields.gender ?? null,
    characteristics: [freeText, fields.characteristics].filter(Boolean).join(" "),
    reporterName: null,
    reporterContact: null,
    rawTranscript: null,
    structuredByClaude: false,
    boothId: null,
    boothName: null,
    createdBy: "search",
    createdAt: new Date().toISOString(),
    matchedCaseId: null,
    confidenceAtMatch: null,
  };
}

/** Text-overlap score (0-100) of query tokens against a case's descriptive text. */
function textScore(queryTokens: string[], c: Case): number | null {
  if (queryTokens.length === 0) return null;
  const haystack = tokenize(
    [
      c.characteristics,
      c.personName,
      c.region,
      c.district,
      c.language,
      c.location?.label,
      c.reportingCenter,
      c.gender,
      c.ageRange,
    ]
      .filter(Boolean)
      .join(" ")
  );
  if (haystack.length === 0) return 0;
  const hay = new Set(haystack);
  let hits = 0;
  for (const t of queryTokens) {
    if (hay.has(t)) hits += 1;
    else if ([...hay].some((h) => h.includes(t) || t.includes(h))) hits += 0.5;
  }
  return Math.min(100, Math.round((hits / queryTokens.length) * 100));
}

export interface SearchResult {
  case: Case;
  score: number;
  breakdown: string[];
}

/** Core ranking: scores a pseudo-case + token bag against the open cases. */
function rank(
  pseudo: Case,
  queryTokens: string[],
  openCases: Case[]
): SearchResult[] {
  const results: SearchResult[] = [];
  for (const c of openCases) {
    const scores: ScoreSet = {
      geo: geoScore(pseudo, c),
      time: null, // time is meaningless for a free-text query
      demographic: demographicScore(pseudo, c),
      language: languageScore(pseudo, c),
      text: textScore(queryTokens, c),
    };
    const score = combineScores(SEARCH_WEIGHTS, scores);
    if (score < 25) continue; // looser floor for free-text exploration
    const breakdown = matchExplanation(pseudo, c, scores);
    const textVal = scores.text ?? null;
    if (textVal !== null && textVal >= 50) {
      breakdown.unshift("✓ Strong description match");
    } else if (textVal !== null && textVal >= 20) {
      breakdown.unshift("~ Partial description match");
    }
    results.push({ case: c, score, breakdown });
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Deterministic free-text search (the no-API-key fallback). Parses the query
 * itself with the naive extractor, then ranks.
 */
export function smartSearch(query: string, openCases: Case[]): SearchResult[] {
  const fields = naiveExtract(query);
  const pseudo = pseudoCaseFrom(fields, query);
  return rank(pseudo, tokenize(query), openCases);
}

/**
 * Search from an already-parsed filter (the Claude path). The free-text query is
 * still used for the text-overlap dimension so descriptive words count.
 */
export function searchByStructured(
  fields: StructuredFields,
  query: string,
  openCases: Case[]
): SearchResult[] {
  const pseudo = pseudoCaseFrom(fields, query);
  // Token bag combines the original query with any characteristics Claude pulled.
  const tokenSource = [query, fields.characteristics].filter(Boolean).join(" ");
  return rank(pseudo, tokenize(tokenSource), openCases);
}
