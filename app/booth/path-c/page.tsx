"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SelectField,
  TextField,
  TextAreaField,
  LocationField,
  PhotoUpload,
} from "@/components/Fields";
import IntakeResult, { CreatedResult } from "@/components/IntakeResult";
import { T } from "@/components/LanguageProvider";
import { AGE_RANGES, GENDERS, LANGUAGES, REGIONS } from "@/lib/constants";
import type { CaseRole } from "@/lib/types";

const ROLE_OPTIONS: Array<{ value: CaseRole; icon: string; label: string }> = [
  { value: "self_missing", icon: "🙋", label: "I am missing / separated" },
  { value: "reporter", icon: "👨‍👩‍👧", label: "Someone else is missing" },
  { value: "reported", icon: "🤝", label: "I found someone" },
  { value: "other", icon: "❓", label: "Other" },
];

function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function PathC() {
  const [language, setLanguage] = useState("");
  const [role, setRole] = useState<CaseRole | "">("");

  const [timeReported, setTimeReported] = useState(nowLocal());
  const [location, setLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [region, setRegion] = useState("");
  const [characteristics, setCharacteristics] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterContact, setReporterContact] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedResult | null>(null);

  function reset() {
    setResult(null);
    setError(null);
    setRole("");
    setCharacteristics("");
    setReporterName("");
    setReporterContact("");
    setPhotoUrl(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!role) {
      setError("Please choose who you are reporting about.");
      return;
    }
    if (!characteristics.trim()) {
      setError("Please add a description (characteristics).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakePath: "C_standard",
          role,
          timeReported: timeReported ? new Date(timeReported).toISOString() : undefined,
          location,
          language,
          region,
          ageRange,
          gender,
          characteristics: characteristics.trim(),
          reporterName: reporterName.trim() || null,
          reporterContact: reporterContact.trim() || null,
          photoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create case");
        return;
      }
      setResult({
        caseId: data.case.id,
        candidates: data.candidates.map((c: any) => ({ score: c.score, caseIdB: c.caseIdB })),
      });
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <IntakeResult result={result} onReset={reset} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/booth" className="text-sm text-teal-600 hover:underline">
        ← <T>Back to intake</T>
      </Link>
      <div className="mb-4 mt-2 flex items-center gap-3">
        <span className="text-4xl">📝</span>
        <div>
          <h1 className="text-2xl font-extrabold text-sky-700"><T>Standard Intake</T></h1>
          <p className="text-sm text-slate-500"><T>Language → who is missing → full details.</T></p>
        </div>
      </div>

      {/* Language picker */}
      <div className="card mb-4">
        <h2 className="mb-3 text-lg font-bold text-slate-700"><T>1. Language</T></h2>
        <SelectField label="Preferred language" value={language} onChange={setLanguage} options={LANGUAGES} />
      </div>

      {/* Role select */}
      <div className="card mb-4">
        <h2 className="mb-3 text-lg font-bold text-slate-700"><T>2. Who is missing?</T></h2>
        <div className="grid grid-cols-2 gap-3">
          {ROLE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => setRole(o.value)}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left font-semibold transition active:scale-95 ${
                role === o.value
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-slate-200 hover:border-teal-300"
              }`}
            >
              <span className="text-2xl">{o.icon}</span>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Full data form */}
      <form onSubmit={submit} className="card space-y-4">
        <h2 className="text-lg font-bold text-slate-700"><T>3. Details</T></h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Time last seen / reported" value={timeReported} onChange={setTimeReported} type="datetime-local" />
          <LocationField label="Location" value={location?.label ?? ""} onChange={setLocation} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Age range" value={ageRange} onChange={setAgeRange} options={AGE_RANGES} />
          <SelectField label="Gender" value={gender} onChange={setGender} options={GENDERS} />
          <SelectField label="Home region" value={region} onChange={setRegion} options={REGIONS} />
        </div>

        <TextAreaField
          label="Characteristics / description"
          value={characteristics}
          onChange={setCharacteristics}
          rows={4}
          placeholder="Clothing, build, distinguishing features, last known activity…"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Reporter name" value={reporterName} onChange={setReporterName} placeholder="Your name" />
          <TextField label="Reporter contact" value={reporterContact} onChange={setReporterContact} placeholder="Phone number" />
        </div>

        <PhotoUpload value={photoUrl} onChange={setPhotoUrl} />

        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <button type="submit" className="btn-primary w-full text-lg" disabled={submitting}>
          {submitting ? <T>Saving…</T> : <T>Create case & find matches</T>}
        </button>
      </form>
    </div>
  );
}
