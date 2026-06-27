import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { COOKIE_NAME, startSession } from "@/lib/session";

export const runtime = "nodejs";

function homeFor(role: string): string {
  if (role === "admin") return "/dashboard";
  if (role === "police") return "/police";
  return "/booth";
}

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: "Username and password required." }, { status: 400 });
  }

  const db = await getDb();
  const user = db.data.users.find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }

  const token = await startSession(user);
  const res = NextResponse.json({
    user: { id: user.id, username: user.username, role: user.role, name: user.name },
    redirect: homeFor(user.role),
  });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
  return res;
}
