"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { T } from "@/components/LanguageProvider";

type LoginType = "staff" | "booth";

const STAFF_DEMO = [
  { role: "Volunteer", username: "volunteer1", password: "Volunteer@123" },
  { role: "Admin", username: "admin", password: "Admin@123" },
  { role: "Police", username: "police1", password: "Police@123" },
];

const BOOTH_DEMO = [
  { role: "Ramkund Ghat Booth", username: "booth1", password: "Booth@123" },
  { role: "Trimbakeshwar Gate Booth", username: "booth2", password: "Booth@123" },
];

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="card mx-auto mt-6 max-w-md text-center text-sm text-slate-500">
          <T>Loading…</T>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<LoginType>("staff");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginType: tab, username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      const next = params.get("next");
      // For booth logins, always land on the intake home even if a stale ?next
      // points elsewhere; otherwise honor the requested page.
      router.push(tab === "booth" ? data.redirect : next || data.redirect);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t: LoginType) {
    setTab(t);
    setError(null);
    setUsername("");
    setPassword("");
  }

  function fill(u: string, p: string) {
    setUsername(u);
    setPassword(p);
  }

  const demo = tab === "staff" ? STAFF_DEMO : BOOTH_DEMO;

  return (
    <div className="mx-auto mt-6 max-w-md">
      <div className="card">
        <div className="mb-5 text-center">
          <div className="text-4xl">🪔</div>
          <h1 className="mt-2 text-2xl font-extrabold text-teal-700">Khoya Paya</h1>
          <p className="text-sm text-slate-500"><T>Missing Persons Management System</T></p>
        </div>

        {/* Tabs */}
        <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => switchTab("staff")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === "staff"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            👮 <T>Volunteer Login</T>
          </button>
          <button
            type="button"
            onClick={() => switchTab("booth")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              tab === "booth"
                ? "bg-white text-teal-700 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            🛖 <T>Booth Login</T>
          </button>
        </div>

        <p className="mb-4 text-center text-xs text-slate-400">
          {tab === "staff"
            ? <T>Control-room admin and police accounts.</T>
            : <T>Each intake booth is its own login, shared by whichever volunteer is on shift.</T>}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="username">
              {tab === "booth" ? <T>Booth username</T> : <T>Username</T>}
            </label>
            <input
              id="username"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password"><T>Password</T></label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? <T>Signing in…</T> : <T>Sign in</T>}
          </button>
        </form>
      </div>

      <div className="card mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-600">
          {tab === "staff" ? <T>Volunteer demo accounts</T> : <T>Booth demo accounts</T>} (<T>click to fill</T>):
        </p>
        <div className="space-y-2">
          {demo.map((d) => (
            <button
              key={d.username}
              onClick={() => fill(d.username, d.password)}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-semibold text-teal-700">{d.role}</span>
              <span className="font-mono text-slate-500">
                {d.username} / {d.password}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
