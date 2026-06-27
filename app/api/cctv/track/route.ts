import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { getDb, newId } from "@/lib/db";
import { getCurrentPrincipal } from "@/lib/session";
import { askClaudeVision, claudeConfigured } from "@/lib/claude";
import { buildTrail } from "@/lib/cctv";
import type { CctvTrack } from "@/lib/types";

export const runtime = "nodejs";

function mediaTypeFor(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

// Reads a locally-uploaded photo and returns it base64-encoded, or null.
function readUploadedImage(photoUrl: string | null): { base64: string; mediaType: string } | null {
  if (!photoUrl || !photoUrl.startsWith("/uploads/")) return null;
  const filePath = path.join(process.cwd(), "public", photoUrl);
  if (!fs.existsSync(filePath)) return null;
  try {
    const buf = fs.readFileSync(filePath);
    return { base64: buf.toString("base64"), mediaType: mediaTypeFor(filePath) };
  } catch {
    return null;
  }
}

// GET /api/cctv/track?caseId=...  -> existing persisted track (no recompute).
export async function GET(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const caseId = new URL(req.url).searchParams.get("caseId");
  if (!caseId) return NextResponse.json({ track: null });

  const db = await getDb();
  const track = db.data.cctvTracks.find((t) => t.caseId === caseId) ?? null;
  return NextResponse.json({ track });
}

// POST /api/cctv/track  body: { caseId }
// Traces the case's subject across the CCTV network. If the case has an uploaded
// photo and a key is set, Claude vision describes the person from the image;
// otherwise the case's characteristics are used. The trail geometry itself is
// always deterministic (lib/cctv.ts). Persists + returns the track.
export async function POST(req: NextRequest) {
  const principal = await getCurrentPrincipal();
  if (!principal) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (principal.role === "police") {
    return NextResponse.json({ error: "Police cannot run traces." }, { status: 403 });
  }

  const { caseId } = await req.json().catch(() => ({}));
  const db = await getDb();
  const theCase = db.data.cases.find((c) => c.id === caseId);
  if (!theCase) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (!theCase.location) {
    return NextResponse.json(
      { error: "This case has no last-seen location, so it can't be traced on CCTV." },
      { status: 400 }
    );
  }

  // Determine the appearance descriptor used to "recognise" the subject.
  let appearance = theCase.characteristics?.trim() || "person of interest";
  let usedVision = false;

  const image = readUploadedImage(theCase.photoUrl);
  if (image && claudeConfigured()) {
    const system = `You assist a missing-persons CCTV operator. Describe ONLY what is visibly true about the main person in the photo, as a short comma-separated appearance descriptor an operator could scan for (approx age, clothing colours/items, build, distinctive features). No names, no speculation, max ~20 words. Return only the descriptor.`;
    const desc = await askClaudeVision(system, "Describe this person for CCTV matching.", image);
    if (desc) {
      appearance = desc.replace(/\s+/g, " ").trim();
      usedVision = true;
    }
  }

  const sightings = buildTrail(theCase.location, theCase.timeReported, appearance);

  const track: CctvTrack = {
    id: newId("cctv"),
    caseId: theCase.id,
    createdAt: new Date().toISOString(),
    appearance,
    usedVision,
    sightings,
  };

  // Replace any previous track for this case.
  db.data.cctvTracks = db.data.cctvTracks.filter((t) => t.caseId !== theCase.id);
  db.data.cctvTracks.push(track);

  db.data.auditLog.push({
    id: newId("audit"),
    caseId: theCase.id,
    action: `CCTV trace run — ${sightings.length} camera sighting(s)${
      usedVision ? " (subject described from photo by Claude vision)" : ""
    }`,
    ...(principal.kind === "booth" ? { byBoothId: principal.id } : { byUserId: principal.id }),
    timestamp: track.createdAt,
  });

  await db.write();
  return NextResponse.json({ track });
}
