// Deterministic, key-free extraction used as the fallback for the Claude-powered
// transcript-structuring and smart-search endpoints. It is intentionally naive —
// regex over numbers + a colour/clothing/relationship vocabulary — but functional
// so the app works end-to-end with no ANTHROPIC_API_KEY set.

import { AGE_RANGES, GENDERS, LANGUAGES, LOCATIONS, REGIONS } from "./constants";

export interface StructuredFields {
  ageRange: string | null;
  gender: string | null;
  characteristics: string | null;
  language: string | null;
  locationHint: string | null;
  region?: string | null;
}

const COLORS = [
  "white", "black", "red", "blue", "green", "yellow", "orange", "purple",
  "pink", "brown", "grey", "gray", "maroon", "saffron", "golden", "cream",
  "navy", "beige",
];

const CLOTHING = [
  "kurta", "saree", "sari", "dhoti", "shirt", "t-shirt", "tshirt", "pant",
  "pants", "trousers", "shorts", "frock", "dress", "cap", "topi", "turban",
  "pagdi", "shawl", "sweater", "jacket", "scarf", "spectacles", "glasses",
  "chappal", "sandals", "shoes", "salwar", "kameez", "lehenga", "blouse",
];

const FEATURES = [
  "stick", "walking stick", "cane", "wheelchair", "beard", "moustache",
  "mole", "scar", "tattoo", "limp", "bald", "spectacles", "glasses",
  "hearing", "deaf", "blind", "tall", "short", "thin", "fat", "heavy",
];

/** Map a bare age number to the dataset's age band. */
export function ageBucketFor(n: number): string {
  if (n <= 12) return "0-12";
  if (n <= 17) return "13-17";
  if (n <= 40) return "18-40";
  if (n <= 60) return "41-60";
  if (n <= 70) return "61-70";
  if (n <= 80) return "71-80";
  return "80+";
}

function findAge(lower: string): string | null {
  // Explicit band first (e.g. "71-80").
  const band = AGE_RANGES.find((a) => lower.includes(a.toLowerCase()));
  if (band) return band;
  // Phrases like "65 years old", "age 70", "about 8".
  const m = lower.match(/\b(\d{1,3})\s*(?:years?|yrs?|saal|year old|y\/o)?\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 0 && n <= 120) return ageBucketFor(n);
  }
  return null;
}

function findGender(lower: string): string | null {
  const explicit = GENDERS.find((g) => g !== "unknown" && lower.includes(g));
  if (explicit) return explicit;
  if (/\b(man|male|boy|gentleman|father|husband|son|grandfather|uncle|brother)\b/.test(lower)) {
    return "male";
  }
  if (/\b(woman|female|girl|lady|mother|wife|daughter|grandmother|aunt|sister)\b/.test(lower)) {
    return "female";
  }
  return null;
}

function findLanguage(lower: string): string | null {
  return LANGUAGES.find((l) => lower.includes(l.toLowerCase())) ?? null;
}

function findRegion(lower: string): string | null {
  return REGIONS.find((r) => lower.includes(r.toLowerCase())) ?? null;
}

function findLocation(lower: string): string | null {
  // Longest matching known location label wins.
  const hit = LOCATIONS
    .filter((l) => lower.includes(l.label.toLowerCase()))
    .sort((a, b) => b.label.length - a.label.length)[0];
  return hit?.label ?? null;
}

function findCharacteristics(text: string, lower: string): string | null {
  const found = new Set<string>();
  for (const word of [...COLORS, ...CLOTHING, ...FEATURES]) {
    if (lower.includes(word)) found.add(word);
  }
  if (found.size === 0) return null;
  return Array.from(found).join(", ");
}

/**
 * Extracts structured fields from a free-text transcript / query without any AI.
 * `hintLanguage` (e.g. the language the booth already selected) is used when no
 * language is mentioned in the text.
 */
export function naiveExtract(
  text: string,
  hintLanguage?: string | null
): StructuredFields {
  const lower = (text || "").toLowerCase();
  return {
    ageRange: findAge(lower),
    gender: findGender(lower),
    characteristics: findCharacteristics(text, lower),
    language: findLanguage(lower) || (hintLanguage ?? null),
    locationHint: findLocation(lower),
    region: findRegion(lower),
  };
}

// --- Normalizers shared with the Claude path -------------------------------
// Claude is asked for free-form values; we snap them onto the app's known
// vocabularies where possible so they flow into the matching engine cleanly.

export function normalizeAge(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  if (AGE_RANGES.includes(v)) return v;
  const num = v.match(/\d{1,3}/);
  if (num) return ageBucketFor(parseInt(num[0], 10));
  return null;
}

export function normalizeGender(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim().toLowerCase();
  if (v.startsWith("m")) return "male";
  if (v.startsWith("f") || v.startsWith("w")) return "female";
  if (GENDERS.includes(v)) return v;
  return null;
}

export function normalizeLanguage(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim().toLowerCase();
  return LANGUAGES.find((l) => l.toLowerCase() === v) ?? null;
}

export function normalizeRegion(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim().toLowerCase();
  return REGIONS.find((r) => r.toLowerCase() === v) ?? value.trim();
}

export function normalizeLocationHint(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim().toLowerCase();
  const exact = LOCATIONS.find((l) => l.label.toLowerCase() === v);
  if (exact) return exact.label;
  const partial = LOCATIONS.find(
    (l) => v.includes(l.label.toLowerCase()) || l.label.toLowerCase().includes(v)
  );
  return partial?.label ?? value.trim();
}
