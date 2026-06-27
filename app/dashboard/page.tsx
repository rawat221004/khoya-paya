"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { T } from "@/components/LanguageProvider";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardData {
  counts: { open: number; pending: number; reunited: number; total: number; dataset: number };
  avgResolutionHours: number | null;
  hotspots: Array<{ label: string; count: number }>;
  boothHotspots: Array<{ booth: string; count: number }>;
  duplicateFlags: Array<{
    caseIdA: string;
    caseIdB: string;
    score: number;
    summaryA: string;
    summaryB: string;
  }>;
  casesByLocation: Array<{ label: string; count: number }>;
  casesByCenter: Array<{ label: string; count: number }>;
  casesOverTime: Array<{ time: string; count: number }>;
  statusBreakdown: Array<{ status: string; count: number }>;
  geo: { policeStations: number; cctvCameras: number; chokepoints: number; zones: number };
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-slate-500"><T>{label}</T></p>
      <p className={`mt-1 text-3xl font-extrabold ${accent}`}>{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="card text-sm text-slate-500"><T>Loading dashboard…</T></div>;
  if (!data || !data.counts) return <div className="card text-sm text-rose-600"><T>Failed to load dashboard.</T></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-teal-700"><T>Control Room Dashboard</T></h1>
        <p className="text-sm text-slate-500">
          <T>Live figures pulled directly from the case database.</T>{" "}
          {data.counts.dataset > 0 && (
            <span className="text-slate-400">
              ({data.counts.dataset} <T>cases imported from the Kumbh Mela 2027 dataset.</T>)
            </span>
          )}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open cases" value={data.counts.open} accent="text-emerald-600" />
        <StatCard label="Pending review" value={data.counts.pending} accent="text-amber-600" />
        <StatCard label="Reunited" value={data.counts.reunited} accent="text-teal-600" />
        <StatCard
          label="Avg resolution"
          value={data.avgResolutionHours !== null ? `${data.avgResolutionHours} h` : "—"}
          accent="text-slate-700"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-bold text-slate-700"><T>Open cases by location</T></h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.casesByLocation} margin={{ left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={70} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0A7E8C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="mb-3 font-bold text-slate-700"><T>Cases reported over time</T></h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.casesOverTime} margin={{ left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={70} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#0A7E8C" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hotspot-by-booth: which intake booth logged how many cases */}
      <div className="card">
        <h2 className="mb-1 font-bold text-slate-700">🛖 <T>Cases logged per booth (hotspot by booth)</T></h2>
        <p className="mb-3 text-xs text-slate-400">
          <T>Every case created during a booth session is stamped with that booth — this shows intake load across the ground.</T>
        </p>
        {data.boothHotspots.length === 0 ? (
          <p className="text-sm text-slate-500"><T>No booth-logged cases yet.</T></p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.boothHotspots} margin={{ left: -10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="booth" angle={-20} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={60} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0A7E8C" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Cross-center distribution + geography coverage */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-bold text-slate-700"><T>Cases by reporting center</T></h2>
          <p className="mb-2 text-xs text-slate-400">
            <T>The core problem: reports are siloed per center. Matching links them across centers.</T>
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.casesByCenter} margin={{ left: -10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 10 }} height={90} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="mb-3 font-bold text-slate-700">🗺 <T>Ground infrastructure (dataset)</T></h2>
          <p className="mb-3 text-xs text-slate-400">
            <T>Real Nashik-Trimbakeshwar geography used for help-point routing and CCTV coverage.</T>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="CCTV cameras" value={data.geo.cctvCameras} accent="text-indigo-600" />
            <StatCard label="Police stations" value={data.geo.policeStations} accent="text-amber-600" />
            <StatCard label="Chokepoints / parking" value={data.geo.chokepoints} accent="text-rose-600" />
            <StatCard label="Zones" value={data.geo.zones} accent="text-teal-600" />
          </div>
        </div>
      </div>

      {/* Hotspots + duplicates */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-bold text-slate-700">🔥 <T>Hotspots (top locations by open cases)</T></h2>
          {data.hotspots.length === 0 ? (
            <p className="text-sm text-slate-500"><T>No open cases.</T></p>
          ) : (
            <ul className="space-y-2">
              {data.hotspots.map((h) => (
                <li key={h.label} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 text-sm text-slate-700">{h.label}</span>
                  <div className="h-3 flex-1 rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full bg-teal-500"
                      style={{
                        width: `${(h.count / data.hotspots[0].count) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-sm font-semibold text-slate-600">{h.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-bold text-slate-700">⚠️ <T>Possible duplicate reports</T></h2>
          {data.duplicateFlags.length === 0 ? (
            <p className="text-sm text-slate-500"><T>No high-confidence duplicates detected.</T></p>
          ) : (
            <ul className="space-y-3">
              {data.duplicateFlags.map((f, i) => (
                <li key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="mb-1 font-semibold text-amber-800">{f.score}% <T>likely the same person</T></div>
                  <div className="flex flex-col gap-1 text-slate-700">
                    <Link href={`/cases/${f.caseIdA}`} className="hover:underline">
                      <span className="font-mono text-xs text-teal-600">{f.caseIdA}</span> — {f.summaryA}
                    </Link>
                    <Link href={`/cases/${f.caseIdB}`} className="hover:underline">
                      <span className="font-mono text-xs text-teal-600">{f.caseIdB}</span> — {f.summaryB}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
