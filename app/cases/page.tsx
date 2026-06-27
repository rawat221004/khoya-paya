"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge, PathBadge, RoleBadge, confidenceColor } from "@/components/CaseBadges";
import { T } from "@/components/LanguageProvider";
import type { Case } from "@/lib/types";

interface SearchResult {
  case: Case;
  score: number;
  breakdown: string[];
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function CaseRow({ c }: { c: Case }) {
  return (
    <Link href={`/cases/${c.id}`} className="block">
      <div className="card transition hover:border-teal-400 hover:shadow">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={c.status} />
          <PathBadge path={c.intakePath} />
          <RoleBadge role={c.role} />
          <span className="ml-auto font-mono text-xs text-slate-400">{c.id}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-700">
          {c.characteristics || "(no description)"}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>📍 {c.location?.label ?? "Unknown location"}</span>
          <span>🗣 {c.language ?? "Unknown lang"}</span>
          <span>🧑 {c.ageRange ?? "?"} · {c.gender ?? "?"}</span>
          <span>🕒 {fmtTime(c.timeReported)}</span>
          {c.reportingCenter && <span>🏷 {c.reportingCenter}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [status, setStatus] = useState("");
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchedWithClaude, setSearchedWithClaude] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (path) params.set("path", path);
    const res = await fetch(`/api/cases?${params.toString()}`);
    const data = await res.json();
    setCases(data.cases ?? []);
    setLoading(false);
  }, [status, path]);

  useEffect(() => {
    load();
  }, [load]);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setSearching(true);
    const res = await fetch("/api/ai/smart-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    setResults(data.results ?? []);
    setSearchedWithClaude(Boolean(data.usedClaude));
    setSearching(false);
  }

  function clearSearch() {
    setQuery("");
    setResults(null);
    setSearchedWithClaude(false);
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold text-teal-700"><T>Cases</T></h1>
      <p className="mb-4 text-sm text-slate-500">
        <T>Browse, filter, or run a free-text smart search powered by the matching engine.</T>
      </p>

      {/* Smart search */}
      <form onSubmit={runSearch} className="card mb-4">
        <label className="label">🔎 <T>Smart search</T></label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='e.g. "white kurta, walking stick, Marathi, near Ramkund"'
          />
          <button type="submit" className="btn-primary whitespace-nowrap" disabled={searching}>
            {searching ? <T>Searching…</T> : <T>Search</T>}
          </button>
          {results !== null && (
            <button type="button" onClick={clearSearch} className="btn-ghost whitespace-nowrap">
              <T>Clear</T>
            </button>
          )}
        </div>
      </form>

      {results !== null ? (
        <div className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
            {results.length} ranked result{results.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
            {searchedWithClaude ? (
              <span className="badge bg-teal-100 text-teal-700">✨ <T>parsed by Claude</T></span>
            ) : (
              <span className="badge bg-slate-100 text-slate-500">⚙ <T>keyword fallback</T></span>
            )}
          </p>
          {results.length === 0 && (
            <div className="card text-sm text-slate-500"><T>No matching open cases.</T></div>
          )}
          {results.map((r) => (
            <Link key={r.case.id} href={`/cases/${r.case.id}`} className="block">
              <div className="card transition hover:border-teal-400 hover:shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-full text-white" >
                    <span className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${confidenceColor(r.score)}`}>
                      {r.score}%
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={r.case.status} />
                      <PathBadge path={r.case.intakePath} />
                      <span className="font-mono text-xs text-slate-400">{r.case.id}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{r.case.characteristics}</p>
                  </div>
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  {r.breakdown.slice(0, 4).map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="card mb-4 flex flex-wrap gap-4">
            <div>
              <label className="label"><T>Status</T></label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value=""><T>All</T></option>
                <option value="open">Open</option>
                <option value="matched_pending">Pending</option>
                <option value="closed">Reunited</option>
              </select>
            </div>
            <div>
              <label className="label"><T>Intake path</T></label>
              <select className="input" value={path} onChange={(e) => setPath(e.target.value)}>
                <option value=""><T>All</T></option>
                <option value="A_child">Path A · Child</option>
                <option value="B_elderly">Path B · Elderly</option>
                <option value="C_standard">Path C · Standard</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="card text-sm text-slate-500"><T>Loading…</T></div>
          ) : cases.length === 0 ? (
            <div className="card text-sm text-slate-500"><T>No cases match these filters.</T></div>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => (
                <CaseRow key={c.id} c={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
