"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DEMO = [
  { role: "Admin", username: "admin", password: "Admin@123" },
  { role: "Volunteer", username: "volunteer1", password: "Volunteer@123" },
  { role: "Police", username: "police1", password: "Police@123" },
];

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card mx-auto mt-6 max-w-md text-center text-sm text-slate-500">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
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
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      const next = params.get("next");
      router.push(next || data.redirect);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function fill(u: string, p: string) {
    setUsername(u);
    setPassword(p);
  }

  return (
    <div className="mx-auto mt-6 max-w-md">
      <div className="card">
        <div className="mb-5 text-center">
          <div className="text-4xl">🪔</div>
          <h1 className="mt-2 text-2xl font-extrabold text-teal-700">Kumbh Setu</h1>
          <p className="text-sm text-slate-500">Missing Persons Management System</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label" htmlFor="username">Username</label>
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
            <label className="label" htmlFor="password">Password</label>
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
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <div className="card mt-4">
        <p className="mb-2 text-sm font-semibold text-slate-600">Demo accounts (click to fill):</p>
        <div className="space-y-2">
          {DEMO.map((d) => (
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
