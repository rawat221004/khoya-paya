import { NextResponse } from "next/server";
import { getCurrentPrincipal } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const principal = await getCurrentPrincipal();
  if (!principal) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  // Returned under `user` for backwards compatibility with existing consumers
  // (Navbar, case detail). For a booth login this is the booth principal.
  return NextResponse.json({
    user: {
      id: principal.id,
      username: principal.username,
      role: principal.role,
      name: principal.name,
      kind: principal.kind,
      boothName: principal.kind === "booth" ? principal.name : null,
      location: principal.location,
    },
  });
}
