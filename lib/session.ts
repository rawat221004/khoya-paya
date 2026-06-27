// Dependency-free cookie session: an httpOnly cookie holds a signed token.
// The token payload carries the session id, user id and role. The signature is
// an HMAC-SHA256 over the payload using a server secret, so it cannot be forged.
// The session id is also stored in lowdb (sessions collection) and validated on
// the server. Middleware (Edge runtime) verifies the signature only.

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb, newId } from "./db";
import type { Role, User } from "./types";

export const COOKIE_NAME = "kumbh_session";
const SECRET =
  process.env.SESSION_SECRET || "kumbh-setu-dev-secret-key-change-me-please";

interface TokenPayload {
  sid: string;
  uid: string;
  role: Role;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payloadB64: string): string {
  return b64url(
    crypto.createHmac("sha256", SECRET).update(payloadB64).digest()
  );
}

export function createToken(payload: TokenPayload): string {
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export function verifyToken(token: string | undefined): TokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expected = sign(payloadB64);
  // constant-time compare
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    const json = Buffer.from(payloadB64, "base64").toString("utf8");
    return JSON.parse(json) as TokenPayload;
  } catch {
    return null;
  }
}

/** Creates a session row in lowdb and returns the signed cookie token. */
export async function startSession(user: User): Promise<string> {
  const db = await getDb();
  const sid = newId("sess");
  db.data.sessions.push({
    id: sid,
    userId: user.id,
    createdAt: new Date().toISOString(),
  });
  await db.write();
  return createToken({ sid, uid: user.id, role: user.role });
}

/** Reads the cookie, verifies the signature, and validates against lowdb. */
export async function getSessionUser(): Promise<User | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const payload = verifyToken(token);
  if (!payload) return null;
  const db = await getDb();
  const session = db.data.sessions.find((s) => s.id === payload.sid);
  if (!session) return null;
  const user = db.data.users.find((u) => u.id === session.userId);
  return user ?? null;
}

export async function endSession(): Promise<void> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const payload = verifyToken(token);
  if (payload) {
    const db = await getDb();
    db.data.sessions = db.data.sessions.filter((s) => s.id !== payload.sid);
    await db.write();
  }
}
