import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { candidatesForCase } from "@/lib/cases";

export const runtime = "nodejs";

// GET /api/cases/[id] -> case + ranked candidates + timeline
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const theCase = db.data.cases.find((c) => c.id === params.id);
  if (!theCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const userName = (id: string) =>
    db.data.users.find((u) => u.id === id)?.name ?? id;

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
    .map((a) => ({ ...a, byName: userName(a.byUserId) }));

  const matchedCase = theCase.matchedCaseId
    ? db.data.cases.find((c) => c.id === theCase.matchedCaseId) ?? null
    : null;

  return NextResponse.json({
    case: { ...theCase, createdByName: userName(theCase.createdBy) },
    candidates,
    timeline,
    matchedCase,
  });
}
