import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { geoStats } from "@/lib/geodata";
import type { Case } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/dashboard -> live stats for the admin dashboard
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const cases = db.data.cases;

  const open = cases.filter((c) => c.status === "open").length;
  const pending = cases.filter((c) => c.status === "matched_pending").length;
  const reunited = cases.filter((c) => c.status === "closed").length;

  // Average resolution time (hours): for each closed case, the gap between its
  // creation and its latest audit entry (the confirm/reunite outcome). This
  // covers both volunteer-confirmed matches and imported "Reunited" outcomes.
  const lastAuditByCase = new Map<string, number>();
  for (const a of db.data.auditLog) {
    const t = Date.parse(a.timestamp);
    if (Number.isNaN(t)) continue;
    const prev = lastAuditByCase.get(a.caseId);
    if (prev === undefined || t > prev) lastAuditByCase.set(a.caseId, t);
  }
  const durations: number[] = [];
  for (const c of cases) {
    if (c.status !== "closed") continue;
    const last = lastAuditByCase.get(c.id);
    if (last === undefined) continue;
    const ms = last - Date.parse(c.createdAt);
    if (!Number.isNaN(ms) && ms > 0) durations.push(ms / 36e5);
  }
  const avgResolutionHours =
    durations.length > 0
      ? Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10
      : null;

  // Hotspots: top locations by OPEN-case count.
  const locCounts = new Map<string, number>();
  for (const c of cases) {
    if (c.status === "closed") continue;
    const label = c.location?.label ?? "Unknown";
    locCounts.set(label, (locCounts.get(label) ?? 0) + 1);
  }
  const hotspots = [...locCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Duplicate-report flags: still-open pairs with a high candidate score.
  const seenPairs = new Set<string>();
  const duplicateFlags: Array<{
    caseIdA: string;
    caseIdB: string;
    score: number;
    summaryA: string;
    summaryB: string;
  }> = [];
  for (const m of db.data.matchCandidates) {
    if (m.score < 70) continue;
    const key = [m.caseIdA, m.caseIdB].sort().join("|");
    if (seenPairs.has(key)) continue;
    const a = cases.find((c) => c.id === m.caseIdA);
    const b = cases.find((c) => c.id === m.caseIdB);
    if (!a || !b) continue;
    if (a.status === "closed" || b.status === "closed") continue;
    seenPairs.add(key);
    duplicateFlags.push({
      caseIdA: a.id,
      caseIdB: b.id,
      score: m.score,
      summaryA: summarize(a),
      summaryB: summarize(b),
    });
  }
  duplicateFlags.sort((x, y) => y.score - x.score);

  // Chart: open cases by location (bar).
  const casesByLocation = hotspots.slice(0, 8);

  // Chart: cases reported over time, bucketed by hour (line).
  const timeBuckets = new Map<string, number>();
  for (const c of cases) {
    const d = new Date(c.timeReported);
    if (Number.isNaN(d.getTime())) continue;
    const bucket = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(
      d.getDate()
    ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`;
    timeBuckets.set(bucket, (timeBuckets.get(bucket) ?? 0) + 1);
  }
  const casesOverTime = [...timeBuckets.entries()]
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.time.localeCompare(b.time));

  // Chart: status breakdown.
  const statusBreakdown = [
    { status: "Open", count: open },
    { status: "Pending", count: pending },
    { status: "Reunited", count: reunited },
  ];

  // Cross-center distribution (the core "no cross-center search" problem).
  const centerCounts = new Map<string, number>();
  for (const c of cases) {
    if (!c.reportingCenter) continue;
    centerCounts.set(c.reportingCenter, (centerCounts.get(c.reportingCenter) ?? 0) + 1);
  }
  const casesByCenter = [...centerCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const datasetCount = cases.filter((c) => c.source === "dataset").length;

  return NextResponse.json({
    counts: { open, pending, reunited, total: cases.length, dataset: datasetCount },
    avgResolutionHours,
    hotspots,
    duplicateFlags,
    casesByLocation,
    casesByCenter,
    casesOverTime,
    statusBreakdown,
    geo: geoStats(),
  });
}

function summarize(c: Case): string {
  const parts = [
    c.ageRange ?? "age ?",
    c.gender && c.gender !== "unknown" ? c.gender : null,
    c.language ?? null,
    c.location?.label ?? null,
  ].filter(Boolean);
  return `${parts.join(", ")}`;
}
