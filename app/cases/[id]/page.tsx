"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StatusBadge, PathBadge, RoleBadge, confidenceColor } from "@/components/CaseBadges";
import type { Case } from "@/lib/types";

interface CandidateView {
  id: string;
  score: number;
  breakdown: string[];
  otherCase: Case;
}
interface TimelineEntry {
  id: string;
  action: string;
  byName: string;
  timestamp: string;
}
interface DetailData {
  case: Case & { createdByName: string };
  candidates: CandidateView[];
  timeline: TimelineEntry[];
  matchedCase: Case | null;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-36 shrink-0 font-semibold text-slate-500">{label}</span>
      <span className="text-slate-800">{value || <span className="text-slate-400">—</span>}</span>
    </div>
  );
}

export default function CaseDetail() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [me, setMe] = useState<{ role: string } | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [geo, setGeo] = useState<{
    nearestPolice: { name: string; km: number } | null;
    nearestChokepoint: { name: string; category: string | null; km: number } | null;
    cctvWithin1km: number;
    cctvWithin2km: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/cases/${id}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const d = await res.json();
    setData(d);
    setLoading(false);
    // Fetch nearby help points + CCTV coverage for this case's location.
    if (d?.case?.location) {
      const { lat, lng } = d.case.location;
      fetch(`/api/geo?lat=${lat}&lng=${lng}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((g) => g && setGeo(g))
        .catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    load();
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.user ?? null));
  }, [load]);

  async function confirm(otherCaseId: string) {
    setActing(otherCaseId);
    await fetch(`/api/cases/${id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherCaseId }),
    });
    setActing(null);
    load();
  }

  async function reject(otherCaseId: string) {
    setActing(otherCaseId);
    await fetch(`/api/cases/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherCaseId }),
    });
    setActing(null);
    load();
  }

  if (loading) return <div className="card text-sm text-slate-500">Loading…</div>;
  if (notFound) return <div className="card text-sm text-rose-600">Case not found.</div>;
  if (!data) return null;

  const c = data.case;
  const canAct = me?.role !== "police";

  return (
    <div>
      <Link href="/cases" className="text-sm text-teal-600 hover:underline">
        ← All cases
      </Link>

      <div className="mt-2 grid gap-4 lg:grid-cols-3">
        {/* Left: case fields */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status} />
              <PathBadge path={c.intakePath} />
              <RoleBadge role={c.role} />
              {c.source === "dataset" && (
                <span className="badge bg-indigo-100 text-indigo-700">Dataset</span>
              )}
              {c.isDuplicate && (
                <span className="badge bg-rose-100 text-rose-700">⚠ Duplicate report</span>
              )}
              <span className="ml-auto font-mono text-xs text-slate-400">
                {c.externalId || c.id}
              </span>
            </div>

            <div className="mt-4 flex gap-4">
              {c.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photoUrl} alt="case" className="h-32 w-32 rounded-lg border object-cover" />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dashed border-slate-300 text-4xl text-slate-300">
                  👤
                </div>
              )}
              <div className="flex-1">
                <Row label="Missing person" value={c.personName} />
                <Row label="Description" value={c.characteristics} />
                <Row label="Location" value={c.location?.label} />
                <Row label="Time reported" value={fmt(c.timeReported)} />
                <Row label="Language" value={c.language} />
              </div>
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <Row label="Age range" value={c.ageRange} />
              <Row label="Gender" value={c.gender} />
              <Row label="Home region" value={c.region} />
              <Row label="District" value={c.district} />
              <Row label="Reporting center" value={c.reportingCenter} />
              <Row label="Reporter" value={c.reporterName} />
              <Row label="Reporter contact" value={c.reporterContact} />
              {c.transcript && <Row label="Audio transcript" value={<span className="whitespace-pre-wrap">{c.transcript}</span>} />}
              <Row label="Created by" value={c.createdByName} />
              <Row label="Created at" value={fmt(c.createdAt)} />
            </div>
          </div>

          {/* Matched result */}
          {c.status === "closed" && data.matchedCase && (
            <div className="card border-emerald-300 bg-emerald-50">
              <h2 className="text-lg font-bold text-emerald-800">✅ Reunited</h2>
              <p className="text-sm text-emerald-700">
                Confirmed match with{" "}
                <Link href={`/cases/${data.matchedCase.id}`} className="font-semibold underline">
                  {data.matchedCase.id}
                </Link>
                {c.confidenceAtMatch !== null && ` at ${c.confidenceAtMatch}% confidence`}.
              </p>
            </div>
          )}

          {/* Candidates */}
          {c.status !== "closed" && (
            <div>
              <h2 className="mb-2 text-lg font-bold text-slate-700">
                Match candidates ({data.candidates.length})
              </h2>
              {data.candidates.length === 0 ? (
                <div className="card text-sm text-slate-500">
                  No candidates above the review threshold yet. This case will be
                  re-scored automatically as new cases are created.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.candidates.map((cand) => (
                    <div key={cand.id} className="card">
                      <div className="flex items-start gap-4">
                        <span
                          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${confidenceColor(
                            cand.score
                          )}`}
                        >
                          {cand.score}%
                        </span>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {cand.score >= 90 && (
                              <span className="badge bg-emerald-100 text-emerald-700">
                                Instant match
                              </span>
                            )}
                            {cand.score >= 40 && cand.score < 90 && (
                              <span className="badge bg-amber-100 text-amber-800">
                                Review
                              </span>
                            )}
                            <StatusBadge status={cand.otherCase.status} />
                            <PathBadge path={cand.otherCase.intakePath} />
                            <Link
                              href={`/cases/${cand.otherCase.id}`}
                              className="font-mono text-xs text-teal-600 hover:underline"
                            >
                              {cand.otherCase.id}
                            </Link>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">
                            {cand.otherCase.characteristics}
                          </p>
                          <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                            {cand.breakdown.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>

                          {canAct && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => confirm(cand.otherCase.id)}
                                className="btn-primary"
                                disabled={acting === cand.otherCase.id}
                              >
                                ✓ Confirm Match
                              </button>
                              <button
                                onClick={() => reject(cand.otherCase.id)}
                                className="btn-secondary"
                                disabled={acting === cand.otherCase.id}
                              >
                                ✗ Not a Match
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: geography + timeline */}
        <div className="space-y-4">
          {c.location && (
            <div>
              <h2 className="mb-2 text-lg font-bold text-slate-700">Nearby help &amp; coverage</h2>
              <div className="card text-sm">
                {geo ? (
                  <ul className="space-y-2">
                    <li>
                      🚓 <span className="font-semibold">Nearest police station:</span>{" "}
                      {geo.nearestPolice
                        ? `${geo.nearestPolice.name} (${geo.nearestPolice.km} km)`
                        : "—"}
                    </li>
                    <li>
                      🚧 <span className="font-semibold">Nearest chokepoint:</span>{" "}
                      {geo.nearestChokepoint
                        ? `${geo.nearestChokepoint.name} (${geo.nearestChokepoint.km} km)`
                        : "—"}
                    </li>
                    <li>
                      📹 <span className="font-semibold">CCTV coverage:</span>{" "}
                      {geo.cctvWithin1km} cameras within 1 km, {geo.cctvWithin2km} within 2 km
                    </li>
                  </ul>
                ) : (
                  <p className="text-slate-400">Loading coverage…</p>
                )}
              </div>
            </div>
          )}

          <h2 className="mb-2 text-lg font-bold text-slate-700">Case timeline</h2>
          <div className="card">
            <ol className="relative space-y-4 border-l border-slate-200 pl-4">
              {data.timeline.map((t) => (
                <li key={t.id} className="relative">
                  <span className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-teal-500" />
                  <p className="text-sm text-slate-800">{t.action}</p>
                  <p className="text-xs text-slate-400">
                    {fmt(t.timestamp)} · {t.byName}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
