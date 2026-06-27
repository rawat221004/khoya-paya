import { NextRequest, NextResponse } from "next/server";
import { getDb, newId } from "@/lib/db";
import { getCurrentPrincipal } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/cases/[id]/confirm  body: { otherCaseId }
// Confirms a match: closes BOTH cases, links them, writes audit entries.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (principal.role === "police") {
    return NextResponse.json({ error: "Police cannot confirm matches." }, { status: 403 });
  }
  const by =
    principal.kind === "booth"
      ? { byBoothId: principal.id }
      : { byUserId: principal.id };

  const { otherCaseId } = await req.json().catch(() => ({}));
  const db = await getDb();

  const caseA = db.data.cases.find((c) => c.id === params.id);
  const caseB = db.data.cases.find((c) => c.id === otherCaseId);
  if (!caseA || !caseB) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  if (caseA.status === "closed" || caseB.status === "closed") {
    return NextResponse.json({ error: "One of the cases is already closed." }, { status: 409 });
  }

  // Find the score we recorded for this pair (either direction).
  const mc = db.data.matchCandidates.find(
    (m) =>
      (m.caseIdA === caseA.id && m.caseIdB === caseB.id) ||
      (m.caseIdA === caseB.id && m.caseIdB === caseA.id)
  );
  const confidence = mc?.score ?? null;
  const now = new Date().toISOString();

  for (const [self, other] of [
    [caseA, caseB],
    [caseB, caseA],
  ] as const) {
    self.status = "closed";
    self.matchedCaseId = other.id;
    self.confidenceAtMatch = confidence;
    db.data.auditLog.push({
      id: newId("audit"),
      caseId: self.id,
      action: `Match CONFIRMED with case ${other.id}${
        confidence !== null ? ` at ${confidence}% confidence` : ""
      } — case closed (reunited)`,
      ...by,
      timestamp: now,
    });
  }

  await db.write();
  return NextResponse.json({ ok: true, caseA, caseB });
}
