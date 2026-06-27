"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Me {
  id: string;
  username: string;
  role: "admin" | "volunteer" | "police";
  name: string;
}

const ROLE_LINKS: Record<Me["role"], Array<{ href: string; label: string }>> = {
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/booth", label: "Intake" },
    { href: "/cases", label: "Cases" },
    { href: "/police", label: "Police Feed" },
  ],
  volunteer: [
    { href: "/booth", label: "Intake" },
    { href: "/cases", label: "Cases" },
  ],
  police: [
    { href: "/police", label: "Police Feed" },
    { href: "/cases", label: "Cases" },
  ],
};

const ROLE_BADGE: Record<Me["role"], string> = {
  admin: "bg-purple-100 text-purple-700",
  volunteer: "bg-teal-100 text-teal-700",
  police: "bg-amber-100 text-amber-800",
};

export default function Navbar() {
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active) {
          setMe(data?.user ?? null);
          setLoaded(true);
        }
      })
      .catch(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    router.push("/login");
    router.refresh();
  }

  const links = me ? ROLE_LINKS[me.role] : [];

  return (
    <header className="border-b border-teal-700 bg-teal-600 text-white">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3">
        <Link href={me ? "/cases" : "/login"} className="flex items-center gap-2">
          <span className="text-2xl">🪔</span>
          <span className="text-lg font-extrabold tracking-tight">
            Kumbh Setu
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 sm:flex">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  active ? "bg-white/20" : "hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {loaded && me ? (
            <>
              <span className="hidden text-sm sm:inline">{me.name}</span>
              <span className={`badge ${ROLE_BADGE[me.role]}`}>{me.role}</span>
              <button onClick={logout} className="rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">
                Logout
              </button>
            </>
          ) : (
            loaded && (
              <Link href="/login" className="rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">
                Login
              </Link>
            )
          )}
        </div>
      </div>

      {/* Mobile nav row */}
      {me && (
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 sm:hidden">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold ${
                  active ? "bg-white/20" : "hover:bg-white/10"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
