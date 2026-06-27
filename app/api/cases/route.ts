import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentPrincipal } from "@/lib/session";
import { createCaseWithMatching, NewCaseInput } from "@/lib/cases";
import { findLocationByLabel } from "@/lib/constants";
import type { Case, CaseRole, IntakePath } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/cases?status=open&path=A_child  -> list cases (newest first)
export async function GET(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const path = searchParams.get("path");
  const role = searchParams.get("role");
  const boothId = searchParams.get("boothId");

  let cases = [...db.data.cases];
  if (status) cases = cases.filter((c) => c.status === status);
  if (path) cases = cases.filter((c) => c.intakePath === path);
  if (role) cases = cases.filter((c) => c.role === role);
  if (boothId) cases = cases.filter((c) => c.boothId === boothId);

  cases.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ cases });
}

const VALID_PATHS: IntakePath[] = ["A_child", "B_elderly", "C_standard"];
const VALID_ROLES: CaseRole[] = ["self_missing", "reported", "reporter", "other"];

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

// POST /api/cases  -> create a case, run matching, return case + candidates
export async function POST(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (principal.role === "police") {
    return NextResponse.json({ error: "Police cannot create cases." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const intakePath: IntakePath = VALID_PATHS.includes(body.intakePath)
    ? body.intakePath
    : "C_standard";
  const role: CaseRole = VALID_ROLES.includes(body.role) ? body.role : "other";

  // Resolve location: accept a full {lat,lng,label} object or a label string.
  let location: Case["location"] = null;
  if (body.location && typeof body.location === "object" && body.location.label) {
    location = {
      lat: Number(body.location.lat),
      lng: Number(body.location.lng),
      label: String(body.location.label),
    };
  } else if (typeof body.locationLabel === "string") {
    location = findLocationByLabel(body.locationLabel);
  }

  // Booth stamping: a case created during a booth session carries that booth's
  // id/name, and defaults its location to the booth's location when none was
  // entered on the form. This powers the dashboard hotspot-by-booth view.
  const isBooth = principal.kind === "booth";
  const boothId = isBooth ? principal.id : null;
  const boothName = isBooth ? principal.name : null;
  if (!location && isBooth && principal.location) {
    location = { ...principal.location };
  }

  const input: NewCaseInput = {
    intakePath,
    role,
    photoUrl: clean(body.photoUrl),
    timeReported: clean(body.timeReported) || new Date().toISOString(),
    location,
    language: clean(body.language),
    region: clean(body.region),
    ageRange: clean(body.ageRange),
    gender: clean(body.gender),
    characteristics: clean(body.characteristics),
    reporterName: clean(body.reporterName),
    reporterContact: clean(body.reporterContact),
    rawTranscript: clean(body.rawTranscript),
    structuredByClaude: body.structuredByClaude === true,
    boothId,
    boothName,
    createdBy: principal.id,
    creatorKind: principal.kind,
  };

  const db = await getDb();
  const { newCase, candidates } = createCaseWithMatching(db, input);
  await db.write();

  return NextResponse.json({ case: newCase, candidates }, { status: 201 });
}
