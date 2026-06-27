// Dependency-free cookie session: an httpOnly cookie holds a signed token.
// The token payload carries the session id, the principal id, the principal kind
// ("user" for staff, "booth" for a booth login) and the route-gating role. The
// signature is an HMAC-SHA256 over the payload using a server secret, so it
// cannot be forged. The session id is also stored in lowdb (sessions collection)
// and validated on the server. Middleware (Edge runtime) verifies the signature
// only.

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb, newId } from "./db";
import type { Booth, GeoPoint, PrincipalKind, PrincipalRole, User } from "./types";

export const COOKIE_NAME = "kumbh_session";
const SECRET =
  process.env.SESSION_SECRET || "kumbh-setu-dev-secret-key-change-me-please";

interface TokenPayload {
  sid: string;
  pid: string; // principal id (user id or booth id)
  kind: PrincipalKind;
  role: PrincipalRole;
}

// A normalized current-principal used by every server handler. A booth carries
// its location so case creation can stamp/default the case location to it.
export interface Principal {
  kind: PrincipalKind;
  id: string;
  username: string;
  name: string;
  role: PrincipalRole;
  location: GeoPoint | null; // set for booths, null for staff
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

/** Creates a session row for a staff user and returns the signed cookie token. */
export async function startUserSession(user: User): Promise<string> {
  return startSession(user.id, "user", user.role);
}

/** Creates a session row for a booth login and returns the signed cookie token. */
export async function startBoothSession(booth: Booth): Promise<string> {
  return startSession(booth.id, "booth", "booth");
}

async function startSession(
  principalId: string,
  kind: PrincipalKind,
  role: PrincipalRole
): Promise<string> {
  const db = await getDb();
  const sid = newId("sess");
  db.data.sessions.push({
    id: sid,
    principalId,
    kind,
    createdAt: new Date().toISOString(),
  });
  await db.write();
  return createToken({ sid, pid: principalId, kind, role });
}

/**
 * Reads the cookie, verifies the signature, validates the session against lowdb,
 * and resolves the principal (staff user or booth) into a normalized shape.
 */
export async function getCurrentPrincipal(): Promise<Principal | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  const payload = verifyToken(token);
  if (!payload) return null;
  const db = await getDb();
  const session = db.data.sessions.find((s) => s.id === payload.sid);
  if (!session) return null;

  if (session.kind === "booth") {
    const booth = db.data.booths.find((b) => b.id === session.principalId);
    if (!booth) return null;
    return {
      kind: "booth",
      id: booth.id,
      username: booth.username,
      name: booth.name,
      role: "booth",
      location: booth.location,
    };
  }

  const user = db.data.users.find((u) => u.id === session.principalId);
  if (!user) return null;
  return {
    kind: "user",
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    location: null,
  };
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
