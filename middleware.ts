// Route protection. Runs in the Edge runtime, so it verifies the signed session
// cookie using Web Crypto (it does NOT touch lowdb — server handlers do the full
// session validation). It reads the role from the verified token to gate routes.

import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "kumbh_session";
const SECRET =
  process.env.SESSION_SECRET || "kumbh-setu-dev-secret-key-change-me-please";

type Role = "admin" | "volunteer" | "police";

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verify(
  token: string | undefined
): Promise<{ uid: string; role: Role } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  const expected = bytesToB64url(expectedBuf);
  if (expected !== sig) return null;

  try {
    const json = new TextDecoder().decode(b64urlToBytes(payloadB64));
    const payload = JSON.parse(json);
    return { uid: payload.uid, role: payload.role };
  } catch {
    return null;
  }
}

// Which roles may access each protected prefix. Admin is allowed everywhere.
const RULES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/dashboard", roles: ["admin"] },
  { prefix: "/police", roles: ["police", "admin"] },
  { prefix: "/booth", roles: ["volunteer", "admin"] },
  { prefix: "/cases", roles: ["admin", "volunteer", "police"] },
];

function homeFor(role: Role): string {
  if (role === "admin") return "/dashboard";
  if (role === "police") return "/police";
  return "/booth";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const session = await verify(req.cookies.get(COOKIE_NAME)?.value);

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!rule.roles.includes(session.role)) {
    const url = req.nextUrl.clone();
    url.pathname = homeFor(session.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/booth/:path*", "/cases/:path*", "/dashboard/:path*", "/police/:path*"],
};
