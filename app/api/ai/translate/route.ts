import { NextRequest, NextResponse } from "next/server";
import { getCurrentPrincipal } from "@/lib/session";
import { askClaude, claudeConfigured } from "@/lib/claude";

export const runtime = "nodejs";

// POST /api/ai/translate
// Input: { text, sourceLang, targetLang }
// Output: { translated, usedClaude, sourceLang, targetLang }
//
// Lets a volunteer read case notes in their own language. Fallback when no key:
// return the original text unchanged with usedClaude=false (the UI shows a
// "translation unavailable" badge).
export async function POST(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const text: string = typeof body.text === "string" ? body.text : "";
  const sourceLang: string =
    typeof body.sourceLang === "string" && body.sourceLang.trim()
      ? body.sourceLang.trim()
      : "auto";
  const targetLang: string =
    typeof body.targetLang === "string" && body.targetLang.trim()
      ? body.targetLang.trim()
      : "English";

  if (!text.trim()) {
    return NextResponse.json({
      translated: "",
      usedClaude: false,
      sourceLang,
      targetLang,
    });
  }

  if (!claudeConfigured()) {
    // Graceful degradation: hand back the original text untouched.
    return NextResponse.json({
      translated: text,
      usedClaude: false,
      sourceLang,
      targetLang,
    });
  }

  const system = `You are a translator for a missing-persons help desk.
Translate the user's text${
    sourceLang !== "auto" ? ` from ${sourceLang}` : ""
  } into ${targetLang}.
Preserve names, places and numbers exactly. Return ONLY the translated text, no quotes, no preamble, no notes.`;

  const translated = await askClaude(system, text);
  if (!translated) {
    return NextResponse.json({
      translated: text,
      usedClaude: false,
      sourceLang,
      targetLang,
    });
  }

  return NextResponse.json({
    translated,
    usedClaude: true,
    sourceLang,
    targetLang,
  });
}
