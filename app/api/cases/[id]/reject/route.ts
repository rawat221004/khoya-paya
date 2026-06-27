import { NextRequest, NextResponse } from "next/server";
import { getDb, newId } from "@/lib/db";
import { getCurrentPrincipal } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/cases/[id]/reject  body: { otherCaseId }
// Dismisses a candidate: removes the candidate rows for this pair (both
// directions) so it won't resurface. Case stays open for future re-scoring.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (principal.role === "police") {
    return NextResponse.json({ error: "Police cannot reject matches." }, { status: 403 });
  }
  const by =
    principal.kind === "booth"
      ? { byBoothId: principal.id }
      : { byUserId: principal.id };

  const { otherCaseId } = await req.json().catch(() => ({}));
  const db = await getDb();

  const theCase = db.data.cases.find((c) => c.id === params.id);
  if (!theCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const before = db.data.matchCandidates.length;
  db.data.matchCandidates = db.data.matchCandidates.filter(
    (m) =>
      !(
        (m.caseIdA === params.id && m.caseIdB === otherCaseId) ||
        (m.caseIdA === otherCaseId && m.caseIdB === params.id)
      )
  );
  const removed = before - db.data.matchCandidates.length;

  db.data.auditLog.push({
    id: newId("audit"),
    caseId: params.id,
    action: `Candidate match with case ${otherCaseId} dismissed (not a match)`,
    ...by,
    timestamp: new Date().toISOString(),
  });

  await db.write();
  return NextResponse.json({ ok: true, removed });
}
