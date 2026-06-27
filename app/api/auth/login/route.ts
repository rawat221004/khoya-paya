import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import {
  COOKIE_NAME,
  startUserSession,
  startBoothSession,
} from "@/lib/session";

export const runtime = "nodejs";

// POST /api/auth/login  body: { loginType: "staff" | "booth", username, password }
export async function POST(req: NextRequest) {
  const { loginType, username, password } = await req
    .json()
    .catch(() => ({}));

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required." },
      { status: 400 }
    );
  }

  const db = await getDb();

  if (loginType === "booth") {
    const booth = db.data.booths.find((b) => b.username === username);
    if (!booth || !bcrypt.compareSync(password, booth.passwordHash)) {
      return NextResponse.json(
        { error: "Invalid booth username or password." },
        { status: 401 }
      );
    }
    const token = await startBoothSession(booth);
    const res = NextResponse.json({
      principal: {
        id: booth.id,
        username: booth.username,
        role: "booth",
        name: booth.name,
        kind: "booth",
      },
      redirect: "/booth",
    });
    setCookie(res, token);
    return res;
  }

  // Default: staff login (admin / police).
  const user = db.data.users.find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return NextResponse.json(
      { error: "Invalid username or password." },
      { status: 401 }
    );
  }

  const token = await startUserSession(user);
  const res = NextResponse.json({
    principal: {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      kind: "user",
    },
    redirect: user.role === "admin" ? "/dashboard" : "/police",
  });
  setCookie(res, token);
  return res;
}

function setCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  });
}
