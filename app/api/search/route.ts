import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentPrincipal } from "@/lib/session";
import { smartSearch } from "@/lib/search";

export const runtime = "nodejs";

// POST /api/search  body: { query }  -> ranked open-case results (deterministic).
// This is the always-on keyword search. The Claude-augmented variant lives at
// /api/ai/smart-search and falls back to this same engine when no key is set.
export async function POST(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { query } = await req.json().catch(() => ({}));
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return NextResponse.json({ results: [] });
  }

  const db = await getDb();
  const openCases = db.data.cases.filter((c) => c.status !== "closed");
  const results = smartSearch(query, openCases);
  return NextResponse.json({ results });
}
