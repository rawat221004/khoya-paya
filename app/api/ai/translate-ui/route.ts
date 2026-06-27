import { NextRequest, NextResponse } from "next/server";
import { getCurrentPrincipal } from "@/lib/session";
import { askClaude, claudeConfigured, parseClaudeJson } from "@/lib/claude";

export const runtime = "nodejs";

// POST /api/ai/translate-ui
// Input: { texts: string[], targetLang }
// Output: { translations: string[] (aligned to input), usedClaude }
//
// Batch-translates the app's interface strings into the chosen language. Powers
// the global language switcher. Fallback (no key / English / failure): returns
// the original strings unchanged so the UI always renders.
export async function POST(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const texts: string[] = Array.isArray(body.texts)
    ? body.texts.filter((t: unknown): t is string => typeof t === "string")
    : [];
  const targetLang: string =
    typeof body.targetLang === "string" && body.targetLang.trim()
      ? body.targetLang.trim()
      : "English";

  // Nothing to do, English target, or no key -> identity (graceful).
  if (texts.length === 0 || targetLang.toLowerCase() === "english" || !claudeConfigured()) {
    return NextResponse.json({ translations: texts, usedClaude: false });
  }

  const system = `You localize a missing-persons relief web app's interface into ${targetLang}.
You are given a JSON array of UI strings (button labels, headings, hints).
Translate each into natural, concise ${targetLang} suitable for on-screen UI.
Rules:
- Keep it short — these are UI labels, not sentences to pad.
- Preserve any leading emoji/icons and trailing punctuation exactly.
- Do NOT translate proper nouns/brand "Khoya Paya", place names, or example text inside quotes.
- Return ONLY strict minified JSON of the form {"translations": ["...", "..."]} with EXACTLY the same number of items, in the same order. No prose.`;

  const userContent = JSON.stringify({ strings: texts });

  // Allow a larger budget than the default since this is a batch.
  const text = await askClaude(system, userContent, 4000);
  const parsed = parseClaudeJson<{ translations?: unknown }>(text);
  const out = parsed && Array.isArray(parsed.translations) ? parsed.translations : null;

  if (!out || out.length !== texts.length) {
    // Couldn't parse a clean aligned array — fall back to originals.
    return NextResponse.json({ translations: texts, usedClaude: false });
  }

  const translations = out.map((t, i) =>
    typeof t === "string" && t.trim() ? t : texts[i]
  );
  return NextResponse.json({ translations, usedClaude: true });
}
