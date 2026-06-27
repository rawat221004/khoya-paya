import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentPrincipal } from "@/lib/session";
import { candidatesForCase } from "@/lib/cases";
import type { DbData } from "@/lib/types";
import type { Low } from "lowdb";

export const runtime = "nodejs";

// Resolves any principal id (user or booth) to a human-readable name.
function principalName(db: Low<DbData>, id: string | undefined): string {
  if (!id) return "system";
  const user = db.data.users.find((u) => u.id === id);
  if (user) return user.name;
  const booth = db.data.booths.find((b) => b.id === id);
  if (booth) return booth.name;
  return id;
}

// GET /api/cases/[id] -> case + ranked candidates + timeline
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const theCase = db.data.cases.find((c) => c.id === params.id);
  if (!theCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const candidates = candidatesForCase(db, theCase.id).map(
    ({ candidate, otherCase }) => ({
      id: candidate.id,
      score: candidate.score,
      breakdown: candidate.breakdown,
      otherCase,
    })
  );

  const timeline = db.data.auditLog
    .filter((a) => a.caseId === theCase.id)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((a) => ({
      ...a,
      byName: principalName(db, a.byBoothId ?? a.byUserId),
    }));

  const matchedCase = theCase.matchedCaseId
    ? db.data.cases.find((c) => c.id === theCase.matchedCaseId) ?? null
    : null;

  return NextResponse.json({
    case: { ...theCase, createdByName: principalName(db, theCase.createdBy) },
    candidates,
    timeline,
    matchedCase,
  });
}
