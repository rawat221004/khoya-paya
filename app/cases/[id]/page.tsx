"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { StatusBadge, PathBadge, RoleBadge, confidenceColor } from "@/components/CaseBadges";
import { T } from "@/components/LanguageProvider";
import { LANGUAGES } from "@/lib/constants";
import type { Case } from "@/lib/types";

interface AiExplanation {
  bullets: string[];
  usedClaude: boolean;
}

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

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
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

  // AI explanations per candidate (keyed by the other case id).
  const [explanations, setExplanations] = useState<Record<string, AiExplanation>>({});
  const [explaining, setExplaining] = useState<string | null>(null);

  // Translation of the case notes.
  const [translateTarget, setTranslateTarget] = useState("English");
  const [translating, setTranslating] = useState(false);
  const [translation, setTranslation] = useState<
    { text: string; usedClaude: boolean; target: string } | null
  >(null);
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

  async function explain(otherCaseId: string) {
    setExplaining(otherCaseId);
    try {
      const res = await fetch("/api/ai/explain-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: id, otherCaseId }),
      });
      const d = await res.json();
      setExplanations((prev) => ({
        ...prev,
        [otherCaseId]: { bullets: d.bullets ?? [], usedClaude: Boolean(d.usedClaude) },
      }));
    } catch {
      /* keep the rule-based breakdown on failure */
    } finally {
      setExplaining(null);
    }
  }

  async function translateNotes() {
    if (!data) return;
    const c = data.case;
    const source = [c.characteristics, c.rawTranscript].filter(Boolean).join("\n\n");
    if (!source.trim()) return;
    setTranslating(true);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: source,
          sourceLang: c.language || "auto",
          targetLang: translateTarget,
        }),
      });
      const d = await res.json();
      setTranslation({
        text: d.translated ?? source,
        usedClaude: Boolean(d.usedClaude),
        target: translateTarget,
      });
    } catch {
      setTranslation({ text: source, usedClaude: false, target: translateTarget });
    } finally {
      setTranslating(false);
    }
  }

  if (loading) return <div className="card text-sm text-slate-500"><T>Loading…</T></div>;
  if (notFound) return <div className="card text-sm text-rose-600"><T>Case not found.</T></div>;
  if (!data) return null;

  const c = data.case;
  const canAct = me?.role !== "police";

  return (
    <div>
      <Link href="/cases" className="text-sm text-teal-600 hover:underline">
        ← <T>All cases</T>
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
                <span className="badge bg-indigo-100 text-indigo-700"><T>Dataset</T></span>
              )}
              {c.isDuplicate && (
                <span className="badge bg-rose-100 text-rose-700">⚠ <T>Duplicate report</T></span>
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
                <Row label={<T>Missing person</T>} value={c.personName} />
                <Row label={<T>Description</T>} value={c.characteristics} />
                <Row label={<T>Location</T>} value={c.location?.label} />
                <Row label={<T>Time reported</T>} value={fmt(c.timeReported)} />
                <Row label={<T>Language</T>} value={c.language} />
              </div>
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3">
              <Row label={<T>Age range</T>} value={c.ageRange} />
              <Row label={<T>Gender</T>} value={c.gender} />
              <Row label={<T>Home region</T>} value={c.region} />
              <Row label={<T>District</T>} value={c.district} />
              <Row label={<T>Reporting center</T>} value={c.reportingCenter} />
              <Row label={<T>Reporter</T>} value={c.reporterName} />
              <Row label={<T>Reporter contact</T>} value={c.reporterContact} />
              {c.rawTranscript && (
                <Row
                  label={<T>Raw transcript</T>}
                  value={
                    <span className="whitespace-pre-wrap">
                      {c.rawTranscript}
                      {c.structuredByClaude && (
                        <span className="ml-2 badge bg-teal-100 text-teal-700">
                          ✨ <T>structured by Claude</T>
                        </span>
                      )}
                    </span>
                  }
                />
              )}
              {c.boothName && <Row label={<T>Logged at booth</T>} value={`🛖 ${c.boothName}`} />}
              <Row label={<T>Created by</T>} value={c.createdByName} />
              <Row label={<T>Created at</T>} value={fmt(c.createdAt)} />
            </div>

            {/* Translate notes (Claude when configured, graceful fallback otherwise). */}
            {(c.characteristics || c.rawTranscript) && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-600">🌐 <T>Translate notes</T></span>
                  <select
                    className="input !w-auto !py-1 text-sm"
                    value={translateTarget}
                    onChange={(e) => setTranslateTarget(e.target.value)}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn-secondary !py-1 text-sm"
                    onClick={translateNotes}
                    disabled={translating}
                  >
                    {translating ? <T>Translating…</T> : <T>Translate</T>}
                  </button>
                </div>
                {translation && (
                  <div className="mt-2 text-sm">
                    <p className="whitespace-pre-wrap text-slate-800">{translation.text}</p>
                    {!translation.usedClaude && (
                      <span className="mt-1 inline-block badge bg-amber-100 text-amber-800">
                        <T>translation unavailable — no API key set</T>
                      </span>
                    )}
                    {translation.usedClaude && (
                      <span className="mt-1 inline-block badge bg-teal-100 text-teal-700">
                        ✨ <T>translated to</T> {translation.target} <T>by Claude</T>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Matched result */}
          {c.status === "closed" && data.matchedCase && (
            <div className="card border-emerald-300 bg-emerald-50">
              <h2 className="text-lg font-bold text-emerald-800">✅ <T>Reunited</T></h2>
              <p className="text-sm text-emerald-700">
                <T>Confirmed match with</T>{" "}
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
                <T>Match candidates</T> ({data.candidates.length})
              </h2>
              {data.candidates.length === 0 ? (
                <div className="card text-sm text-slate-500">
                  <T>No candidates above the review threshold yet. This case will be re-scored automatically as new cases are created.</T>
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
                                <T>Instant match</T>
                              </span>
                            )}
                            {cand.score >= 40 && cand.score < 90 && (
                              <span className="badge bg-amber-100 text-amber-800">
                                <T>Review</T>
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
                          {(() => {
                            const ex = explanations[cand.otherCase.id];
                            const bullets = ex ? ex.bullets : cand.breakdown;
                            return (
                              <>
                                <ul className="mt-2 space-y-0.5 text-sm text-slate-600">
                                  {bullets.map((b, i) => (
                                    <li key={i}>{b}</li>
                                  ))}
                                </ul>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => explain(cand.otherCase.id)}
                                    className="text-xs font-semibold text-teal-600 hover:underline disabled:opacity-50"
                                    disabled={explaining === cand.otherCase.id}
                                  >
                                    {explaining === cand.otherCase.id
                                      ? <T>Explaining…</T>
                                      : <>✨ <T>Explain this match</T></>}
                                  </button>
                                  {ex && (
                                    <span
                                      className={`badge ${
                                        ex.usedClaude
                                          ? "bg-teal-100 text-teal-700"
                                          : "bg-slate-100 text-slate-500"
                                      }`}
                                    >
                                      {ex.usedClaude ? <><T>✨ explained by Claude</T></> : <><T>⚙ rule-based (no API key)</T></>}
                                    </span>
                                  )}
                                </div>
                              </>
                            );
                          })()}

                          {canAct && (
                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={() => confirm(cand.otherCase.id)}
                                className="btn-primary"
                                disabled={acting === cand.otherCase.id}
                              >
                                ✓ <T>Confirm Match</T>
                              </button>
                              <button
                                onClick={() => reject(cand.otherCase.id)}
                                className="btn-secondary"
                                disabled={acting === cand.otherCase.id}
                              >
                                ✗ <T>Not a Match</T>
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
              <h2 className="mb-2 text-lg font-bold text-slate-700"><T>Nearby help &amp; coverage</T></h2>
              <div className="card text-sm">
                {geo ? (
                  <ul className="space-y-2">
                    <li>
                      🚓 <span className="font-semibold"><T>Nearest police station:</T></span>{" "}
                      {geo.nearestPolice
                        ? `${geo.nearestPolice.name} (${geo.nearestPolice.km} km)`
                        : "—"}
                    </li>
                    <li>
                      🚧 <span className="font-semibold"><T>Nearest chokepoint:</T></span>{" "}
                      {geo.nearestChokepoint
                        ? `${geo.nearestChokepoint.name} (${geo.nearestChokepoint.km} km)`
                        : "—"}
                    </li>
                    <li>
                      📹 <span className="font-semibold"><T>CCTV coverage:</T></span>{" "}
                      {geo.cctvWithin1km} cameras within 1 km, {geo.cctvWithin2km} within 2 km
                    </li>
                  </ul>
                ) : (
                  <p className="text-slate-400"><T>Loading coverage…</T></p>
                )}
              </div>
            </div>
          )}

          <h2 className="mb-2 text-lg font-bold text-slate-700"><T>Case timeline</T></h2>
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
