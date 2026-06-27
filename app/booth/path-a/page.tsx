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
import { AGE_RANGES, GENDERS, LANGUAGES, REGIONS } from "@/lib/constants";
import { T, useLang } from "@/components/LanguageProvider";

function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function PathA() {
  const { get } = useLang();
  const [foundTime, setFoundTime] = useState(nowLocal());
  const [location, setLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [ageRange, setAgeRange] = useState("");
  const [gender, setGender] = useState("");
  const [language, setLanguage] = useState("");
  const [region, setRegion] = useState("");
  const [characteristics, setCharacteristics] = useState("");
  const [companion, setCompanion] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedResult | null>(null);

  function reset() {
    setResult(null);
    setError(null);
    setCharacteristics("");
    setCompanion("");
    setPhotoUrl(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!characteristics.trim()) {
      setError("Please describe the person (characteristics) before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const fullCharacteristics = companion.trim()
        ? `${characteristics.trim()} | Companion/found-with: ${companion.trim()}`
        : characteristics.trim();
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakePath: "A_child",
          role: "reported",
          timeReported: foundTime ? new Date(foundTime).toISOString() : undefined,
          location,
          ageRange,
          gender,
          language,
          region,
          characteristics: fullCharacteristics,
          photoUrl,
          reporterName: "Volunteer (proxy intake)",
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
        <span className="text-4xl">🧒</span>
        <div>
          <h1 className="text-2xl font-extrabold text-amber-700"><T>Child / Cannot Respond</T></h1>
          <p className="text-sm text-slate-500">
            <T>You (the volunteer) fill in everything you can observe about the found person.</T>
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Time found" value={foundTime} onChange={setFoundTime} type="datetime-local" />
          <LocationField label="Location found" value={location?.label ?? ""} onChange={setLocation} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Approx. age range" value={ageRange} onChange={setAgeRange} options={AGE_RANGES} />
          <SelectField label="Gender" value={gender} onChange={setGender} options={GENDERS} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Language (if known)" value={language} onChange={setLanguage} options={LANGUAGES} hint="Leave blank if unknown — it won't hurt matching." />
          <SelectField label="Home region (if known)" value={region} onChange={setRegion} options={REGIONS} />
        </div>

        <TextAreaField
          label="Characteristics / appearance"
          value={characteristics}
          onChange={setCharacteristics}
          rows={4}
          placeholder="Clothing colour, height, distinctive marks, what the child said, etc."
        />

        <TextField
          label="Companion / found-with details (optional)"
          value={companion}
          onChange={setCompanion}
          placeholder="e.g. found holding a red balloon, was with an older woman in green saree"
        />

        <PhotoUpload value={photoUrl} onChange={setPhotoUrl} />

        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <button type="submit" className="btn-primary w-full text-lg" disabled={submitting}>
          {submitting ? get("Saving…") : get("Create case & find matches")}
        </button>
      </form>
    </div>
  );
}
