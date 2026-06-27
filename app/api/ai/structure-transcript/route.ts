import { NextRequest, NextResponse } from "next/server";
import { getCurrentPrincipal } from "@/lib/session";
import { askClaude, claudeConfigured, parseClaudeJson } from "@/lib/claude";
import {
  naiveExtract,
  normalizeAge,
  normalizeGender,
  normalizeLanguage,
  normalizeLocationHint,
  normalizeRegion,
  type StructuredFields,
} from "@/lib/extract";
import { AGE_RANGES, GENDERS, LANGUAGES, LOCATIONS } from "@/lib/constants";

export const runtime = "nodejs";

// POST /api/ai/structure-transcript
// Input: { rawTranscript, language }
// Output: { structured: StructuredFields, usedClaude: boolean }
//
// Extracts structured fields from a free-text/spoken transcript to prefill the
// Path B intake form. Uses Claude when a key is set; otherwise a naive regex
// extractor (worse, but functional).
export async function POST(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const rawTranscript: string =
    typeof body.rawTranscript === "string" ? body.rawTranscript : "";
  const language: string | null =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim()
      : null;

  if (!rawTranscript.trim()) {
    return NextResponse.json(
      { structured: emptyFields(language), usedClaude: false },
      { status: 200 }
    );
  }

  const system = `You are a careful intake assistant for a missing-persons help desk at the Kumbh Mela.
Read the transcript of answers given by (or about) a person and extract structured fields.
Return ONLY strict minified JSON, no prose, no markdown, with EXACTLY these keys:
{"ageRange": string|null, "gender": string|null, "characteristics": string|null, "language": string|null, "lastSeenLocation": string|null, "region": string|null}
Rules:
- ageRange MUST be one of: ${AGE_RANGES.join(", ")} (pick the closest band), or null if unknown.
- gender MUST be one of: ${GENDERS.join(", ")}, or null if unknown.
- language SHOULD be one of: ${LANGUAGES.join(", ")} if mentioned, else null.
- lastSeenLocation SHOULD be one of these known places if mentioned: ${LOCATIONS.map((l) => l.label).join(", ")}; else a short free-text place or null.
- characteristics: a short comma-separated physical description (clothing, colours, distinctive features). null if none.
- region: the home state/region mentioned, or null.
Do not invent details that are not in the transcript.`;

  const userContent = `Transcript:\n${rawTranscript}\n\n${
    language ? `The person's selected language is ${language}.` : ""
  }`;

  let structured: StructuredFields | null = null;
  let usedClaude = false;

  if (claudeConfigured()) {
    const text = await askClaude(system, userContent);
    const parsed = parseClaudeJson<Record<string, unknown>>(text);
    if (parsed) {
      structured = {
        ageRange: normalizeAge(parsed.ageRange),
        gender: normalizeGender(parsed.gender),
        characteristics:
          typeof parsed.characteristics === "string" &&
          parsed.characteristics.trim()
            ? parsed.characteristics.trim()
            : null,
        language: normalizeLanguage(parsed.language) || language,
        locationHint: normalizeLocationHint(parsed.lastSeenLocation),
        region: normalizeRegion(parsed.region),
      };
      usedClaude = true;
    }
  }

  // Fallback (no key, or Claude returned unparseable output).
  if (!structured) {
    structured = naiveExtract(rawTranscript, language);
    usedClaude = false;
  }

  return NextResponse.json({ structured, usedClaude });
}

function emptyFields(language: string | null): StructuredFields {
  return {
    ageRange: null,
    gender: null,
    characteristics: null,
    language,
    locationHint: null,
    region: null,
  };
}
