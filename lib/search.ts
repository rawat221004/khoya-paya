// Free-text "smart search" that reuses the matching engine. A query string like
// "white kurta, walking stick, Marathi, near Ramkund" is parsed into a partial
// pseudo-case (extracting language and a known location), then scored against
// every open case using the same geo/demographic/language dimensions PLUS a
// text-overlap dimension over the characteristics.

import { LANGUAGES, AGE_RANGES, GENDERS, findLocationByLabel, LOCATIONS } from "./constants";
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

export interface ParsedQuery {
  pseudo: Case;
  queryTokens: string[];
}

/** Builds a partial Case from the free-text query. */
export function parseQuery(query: string): ParsedQuery {
  const lower = query.toLowerCase();

  // Language: first known language mentioned.
  const language =
    LANGUAGES.find((l) => lower.includes(l.toLowerCase())) ?? null;

  // Location: longest known location label that appears in the query.
  let location = null as Case["location"];
  const matchedLoc = LOCATIONS
    .filter((l) => lower.includes(l.label.toLowerCase()))
    .sort((a, b) => b.label.length - a.label.length)[0];
  if (matchedLoc) location = matchedLoc;

  // Age range: explicit "65+" style or a bare number mapped to a bucket.
  let ageRange: string | null =
    AGE_RANGES.find((a) => lower.includes(a.toLowerCase())) ?? null;
  if (!ageRange) {
    const numMatch = lower.match(/\b(\d{1,3})\b/);
    if (numMatch) {
      const n = parseInt(numMatch[1], 10);
      ageRange = ageBucketFor(n);
    }
  }

  // Gender keywords.
  let gender: string | null =
    GENDERS.find((g) => g !== "unknown" && lower.includes(g)) ?? null;
  if (!gender) {
    if (/\b(man|male|boy|gentleman|father|husband|son)\b/.test(lower)) gender = "male";
    else if (/\b(woman|female|girl|lady|mother|wife|daughter)\b/.test(lower)) gender = "female";
  }

  const pseudo: Case = {
    id: "__query__",
    status: "open",
    intakePath: "C_standard",
    role: "other",
    photoUrl: null,
    timeReported: new Date().toISOString(),
    location,
    language,
    region: null,
    ageRange,
    gender,
    characteristics: query,
    reporterName: null,
    reporterContact: null,
    transcript: null,
    createdBy: "search",
    createdAt: new Date().toISOString(),
    matchedCaseId: null,
    confidenceAtMatch: null,
  };

  return { pseudo, queryTokens: tokenize(query) };
}

function ageBucketFor(n: number): string {
  if (n <= 5) return "0-5";
  if (n <= 12) return "6-12";
  if (n <= 19) return "13-19";
  if (n <= 35) return "20-35";
  if (n <= 50) return "36-50";
  if (n <= 65) return "51-65";
  return "65+";
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

export function smartSearch(query: string, openCases: Case[]): SearchResult[] {
  const { pseudo, queryTokens } = parseQuery(query);
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
