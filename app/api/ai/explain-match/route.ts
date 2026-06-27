import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentPrincipal } from "@/lib/session";
import { askClaude, claudeConfigured } from "@/lib/claude";
import {
  geoScore,
  timeScore,
  demographicScore,
  languageScore,
  matchExplanation,
  type ScoreSet,
} from "@/lib/matching";
import type { Case } from "@/lib/types";

export const runtime = "nodejs";

// POST /api/ai/explain-match
// Input (preferred): { caseId, otherCaseId }
// Input (also accepted): { caseA, caseB, scores }
//
// Claude only PHRASES the match — it never computes the confidence number. The
// deterministic scores come from lib/matching.ts. Fallback when no key: the
// existing rule-based matchExplanation() strings, unchanged.
export async function POST(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  let caseA: Case | null = null;
  let caseB: Case | null = null;
  let scores: ScoreSet | null = null;

  if (body.caseId && body.otherCaseId) {
    // Server-authoritative path: load the cases and recompute scores ourselves.
    const db = await getDb();
    caseA = db.data.cases.find((c) => c.id === body.caseId) ?? null;
    caseB = db.data.cases.find((c) => c.id === body.otherCaseId) ?? null;
    if (!caseA || !caseB) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }
    scores = {
      geo: geoScore(caseA, caseB),
      time: timeScore(caseA, caseB),
      demographic: demographicScore(caseA, caseB),
      language: languageScore(caseA, caseB),
    };
  } else if (body.caseA && body.caseB) {
    caseA = body.caseA as Case;
    caseB = body.caseB as Case;
    scores =
      (body.scores as ScoreSet) ?? {
        geo: geoScore(caseA, caseB),
        time: timeScore(caseA, caseB),
        demographic: demographicScore(caseA, caseB),
        language: languageScore(caseA, caseB),
      };
  } else {
    return NextResponse.json({ error: "Missing case data" }, { status: 400 });
  }

  // Deterministic bullets — always available, and the no-key fallback.
  const ruleBullets = matchExplanation(caseA, caseB, scores);
  const targetLang = caseA.language || caseB.language || "English";

  if (!claudeConfigured()) {
    return NextResponse.json({ bullets: ruleBullets, usedClaude: false });
  }

  const system = `You explain to a relief volunteer WHY two missing-person reports might be the same person.
You are given pre-computed signal bullets. Rephrase them as short, warm, plain-language bullet points a volunteer can read at a glance.
- Keep each bullet to one line, prefixed with "✓" for a strong signal, "~" for a partial one, or "✗" for a mismatch.
- Do NOT invent new facts or numbers beyond the signals given.
- If the target language is not English, write the bullets in ${targetLang}.
Return ONLY the bullet lines, one per line, no preamble.`;

  const userContent = `Target language: ${targetLang}
Signals:
${ruleBullets.map((b) => `- ${b}`).join("\n")}

Report A: ${summarize(caseA)}
Report B: ${summarize(caseB)}`;

  const text = await askClaude(system, userContent);
  if (!text) {
    return NextResponse.json({ bullets: ruleBullets, usedClaude: false });
  }

  const bullets = text
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter((l) => l.length > 0);

  return NextResponse.json({
    bullets: bullets.length > 0 ? bullets : ruleBullets,
    usedClaude: bullets.length > 0,
  });
}

function summarize(c: Case): string {
  return [
    c.ageRange ? `age ${c.ageRange}` : null,
    c.gender && c.gender !== "unknown" ? c.gender : null,
    c.language ?? null,
    c.location?.label ? `at ${c.location.label}` : null,
    c.characteristics ?? null,
  ]
    .filter(Boolean)
    .join(", ");
}
