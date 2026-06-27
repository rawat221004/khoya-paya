"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { T, useLang, UI_LANGUAGES } from "@/components/LanguageProvider";

interface Me {
  id: string;
  username: string;
  role: "admin" | "police" | "booth";
  name: string;
  kind?: "user" | "booth";
}

const ROLE_LINKS: Record<Me["role"], Array<{ href: string; label: string }>> = {
  admin: [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/booth", label: "Intake" },
    { href: "/cases", label: "Cases" },
    { href: "/police", label: "Police Feed" },
  ],
  booth: [
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
  booth: "bg-teal-100 text-teal-700",
  police: "bg-amber-100 text-amber-800",
};

const ROLE_LABEL: Record<Me["role"], string> = {
  admin: "admin",
  booth: "booth",
  police: "police",
};

function LanguageSwitcher() {
  const { lang, setLang, translating } = useLang();
  return (
    <div className="flex items-center gap-1">
      {translating && (
        <span className="hidden animate-pulse text-xs text-white/80 sm:inline">
          translating…
        </span>
      )}
      <span aria-hidden className="text-base">🌐</span>
      <select
        aria-label="Interface language"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="rounded-md border border-white/30 bg-teal-700 px-2 py-1 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40"
      >
        {UI_LANGUAGES.map((l) => (
          <option key={l} value={l} className="text-slate-800">
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

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
          <span className="text-lg font-extrabold tracking-tight">Khoya Paya</span>
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
                <T>{l.label}</T>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher />
          {loaded && me ? (
            <>
              <span className="hidden text-sm sm:inline">
                {me.kind === "booth" ? `🛖 ${me.name}` : me.name}
              </span>
              <span className={`badge ${ROLE_BADGE[me.role]}`}>{ROLE_LABEL[me.role]}</span>
              <button
                onClick={logout}
                className="rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
              >
                <T>Logout</T>
              </button>
            </>
          ) : (
            loaded && (
              <Link
                href="/login"
                className="rounded-md bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25"
              >
                <T>Login</T>
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
                <T>{l.label}</T>
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
