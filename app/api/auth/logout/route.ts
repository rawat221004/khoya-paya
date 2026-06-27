import { NextResponse } from "next/server";
import { COOKIE_NAME, endSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST() {
  await endSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
