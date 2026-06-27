import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  nearestPoliceStation,
  nearestChokepoint,
  cctvCoverageNear,
  geoStats,
} from "@/lib/geodata";

export const runtime = "nodejs";

// GET /api/geo?lat=..&lng=..  -> nearest help points + CCTV coverage for a point.
// GET /api/geo                -> overall geography dataset stats.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ stats: geoStats() });
  }

  const point = { lat, lng, label: "" };
  const police = nearestPoliceStation(point);
  const choke = nearestChokepoint(point);

  return NextResponse.json({
    nearestPolice: police
      ? { name: police.station.name, km: Math.round(police.km * 10) / 10 }
      : null,
    nearestChokepoint: choke
      ? {
          name: choke.point.name,
          category: choke.point.category ?? null,
          km: Math.round(choke.km * 10) / 10,
        }
      : null,
    cctvWithin1km: cctvCoverageNear(point, 1),
    cctvWithin2km: cctvCoverageNear(point, 2),
    stats: geoStats(),
  });
}
