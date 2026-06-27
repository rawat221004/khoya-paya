import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentPrincipal } from "@/lib/session";
import { askClaude, claudeConfigured, parseClaudeJson } from "@/lib/claude";
import { smartSearch, searchByStructured } from "@/lib/search";
import {
  normalizeAge,
  normalizeGender,
  normalizeLanguage,
  normalizeLocationHint,
  type StructuredFields,
} from "@/lib/extract";
import { AGE_RANGES, GENDERS, LANGUAGES, LOCATIONS } from "@/lib/constants";

export const runtime = "nodejs";

// POST /api/ai/smart-search
// Input: { query }  (free text, e.g. "white kurta, walking stick, Marathi, near Ramkund")
// Output: { results, usedClaude, parsed }
//
// Claude parses the query into a structured filter; that filter is then run
// through the deterministic matching engine (Claude never ranks). Fallback when
// no key: the keyword-based smartSearch().
export async function POST(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query } = await req.json().catch(() => ({}));
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ results: [], usedClaude: false, parsed: null });
  }

  const db = await getDb();
  const openCases = db.data.cases.filter((c) => c.status !== "closed");

  if (claudeConfigured()) {
    const system = `You parse a relief-worker's free-text description of a missing person into a search filter.
Return ONLY strict minified JSON with EXACTLY these keys:
{"ageRange": string|null, "gender": string|null, "characteristics": string|null, "language": string|null, "locationHint": string|null}
Rules:
- ageRange MUST be one of: ${AGE_RANGES.join(", ")}, or null.
- gender MUST be one of: ${GENDERS.join(", ")}, or null.
- language SHOULD be one of: ${LANGUAGES.join(", ")} if mentioned, else null.
- locationHint SHOULD be one of: ${LOCATIONS.map((l) => l.label).join(", ")} if mentioned, else null.
- characteristics: the descriptive words (clothing, colours, features), comma-separated, or null.
Do not invent details.`;

    const text = await askClaude(system, `Query: ${query}`);
    const parsed = parseClaudeJson<Record<string, unknown>>(text);
    if (parsed) {
      const filter: StructuredFields = {
        ageRange: normalizeAge(parsed.ageRange),
        gender: normalizeGender(parsed.gender),
        characteristics:
          typeof parsed.characteristics === "string" &&
          parsed.characteristics.trim()
            ? parsed.characteristics.trim()
            : null,
        language: normalizeLanguage(parsed.language),
        locationHint: normalizeLocationHint(parsed.locationHint),
      };
      const results = searchByStructured(filter, query, openCases);
      return NextResponse.json({ results, usedClaude: true, parsed: filter });
    }
  }

  // Fallback: deterministic keyword search.
  const results = smartSearch(query, openCases);
  return NextResponse.json({ results, usedClaude: false, parsed: null });
}
