"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge, PathBadge, RoleBadge } from "@/components/CaseBadges";
import type { Case } from "@/lib/types";

// A case is "escalated" if it has stayed open for more than this many hours.
const ESCALATION_HOURS = 12;

function hoursOpen(c: Case): number {
  return (Date.now() - Date.parse(c.timeReported)) / 36e5;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PolicePage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  async function load() {
    const res = await fetch("/api/cases?status=open");
    const data = await res.json();
    setCases(data.cases ?? []);
    setUpdatedAt(new Date().toLocaleTimeString());
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // live refresh every 15s
    return () => clearInterval(t);
  }, []);

  const escalated = cases.filter((c) => hoursOpen(c) > ESCALATION_HOURS);
  const recent = cases.filter((c) => hoursOpen(c) <= ESCALATION_HOURS);

  function Item({ c, escalatedFlag }: { c: Case; escalatedFlag?: boolean }) {
    return (
      <Link href={`/cases/${c.id}`} className="block">
        <div className={`card transition hover:shadow ${escalatedFlag ? "border-rose-300 bg-rose-50" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={c.status} />
            <PathBadge path={c.intakePath} />
            <RoleBadge role={c.role} />
            {escalatedFlag && (
              <span className="badge bg-rose-500 text-white">⏱ Escalated · {Math.floor(hoursOpen(c))}h open</span>
            )}
            <span className="ml-auto font-mono text-xs text-slate-400">{c.id}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700">{c.characteristics || "(no description)"}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>📍 {c.location?.label ?? "Unknown"}</span>
            <span>🗣 {c.language ?? "Unknown"}</span>
            <span>🧑 {c.ageRange ?? "?"} · {c.gender ?? "?"}</span>
            <span>🕒 {fmt(c.timeReported)}</span>
            {c.reportingCenter && <span>🏷 {c.reportingCenter}</span>}
            {c.reporterContact && <span>📞 {c.reporterContact}</span>}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-amber-700">Police Live Feed</h1>
          <p className="text-sm text-slate-500">
            Open cases, auto-refreshing every 15s. {updatedAt && `Last updated ${updatedAt}.`}
          </p>
        </div>
        <span className="flex items-center gap-2 text-sm text-emerald-600">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" /> Live
        </span>
      </div>

      <section>
        <h2 className="mb-2 text-lg font-bold text-rose-700">
          🚨 Escalated ({escalated.length})
        </h2>
        {escalated.length === 0 ? (
          <div className="card text-sm text-slate-500">No escalated cases.</div>
        ) : (
          <div className="space-y-3">
            {escalated.map((c) => (
              <Item key={c.id} c={c} escalatedFlag />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold text-slate-700">Open cases ({recent.length})</h2>
        {recent.length === 0 ? (
          <div className="card text-sm text-slate-500">No recent open cases.</div>
        ) : (
          <div className="space-y-3">
            {recent.map((c) => (
              <Item key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
