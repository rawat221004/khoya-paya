"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SelectField,
  TextField,
  TextAreaField,
  LocationField,
} from "@/components/Fields";
import IntakeResult, { CreatedResult } from "@/components/IntakeResult";
import { AGE_RANGES, GENDERS, LANGUAGES, REGIONS } from "@/lib/constants";

// BCP-47 codes for speech synthesis/recognition per language.
const SPEECH_LANG: Record<string, string> = {
  Hindi: "hi-IN",
  Marathi: "mr-IN",
  Gujarati: "gu-IN",
  Bengali: "bn-IN",
  Punjabi: "pa-IN",
  Nepali: "ne-NP",
  Tamil: "ta-IN",
  Telugu: "te-IN",
  Kannada: "kn-IN",
  Malayalam: "ml-IN",
  English: "en-IN",
};

const QUESTIONS = [
  { key: "name", q: "What is your name?", label: "Name" },
  { key: "region", q: "Which place are you from?", label: "Where from" },
  { key: "companion", q: "Who did you come with? Who are you looking for?", label: "Looking for / came with" },
  { key: "appearance", q: "What are you wearing today?", label: "Appearance" },
];

function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function PathB() {
  const [language, setLanguage] = useState("");
  const [supported, setSupported] = useState({ tts: false, asr: false });
  const [listeningKey, setListeningKey] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [transcript, setTranscript] = useState("");

  const [timeReported, setTimeReported] = useState(nowLocal());
  const [location, setLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [ageRange, setAgeRange] = useState("71-80");
  const [gender, setGender] = useState("");
  const [region, setRegion] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedResult | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const tts = typeof window !== "undefined" && "speechSynthesis" in window;
    const asr =
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
    setSupported({ tts, asr });
  }, []);

  function langCode(): string {
    return SPEECH_LANG[language] || "en-IN";
  }

  function speak(text: string) {
    if (!supported.tts) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = langCode();
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }

  function pickLanguage(lang: string) {
    setLanguage(lang);
    // Speak the language name aloud to confirm selection (per spec).
    if (supported.tts) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(lang);
      u.lang = SPEECH_LANG[lang] || "en-IN";
      window.speechSynthesis.speak(u);
    }
  }

  function listen(key: string, questionText: string) {
    if (!supported.asr) return;
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = langCode();
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    setListeningKey(key);

    rec.onresult = (event: any) => {
      const said = event.results[0][0].transcript as string;
      setAnswers((prev) => ({ ...prev, [key]: said }));
      setTranscript((prev) =>
        `${prev}${prev ? "\n" : ""}Q: ${questionText}\nA: ${said}`.trim()
      );
      // Auto-fill structured fields where we can.
      if (key === "region") {
        const match = REGIONS.find((r) => said.toLowerCase().includes(r.toLowerCase()));
        if (match) setRegion(match);
      }
    };
    rec.onerror = () => setListeningKey(null);
    rec.onend = () => setListeningKey(null);
    rec.start();
  }

  function stopListening() {
    recognitionRef.current?.stop?.();
    setListeningKey(null);
  }

  function setAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setResult(null);
    setError(null);
    setAnswers({});
    setTranscript("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = answers.name?.trim();
    const characteristicsParts = [
      name ? `Name: ${name}` : null,
      answers.appearance?.trim() ? `Wearing: ${answers.appearance.trim()}` : null,
      answers.companion?.trim() ? `Looking for / came with: ${answers.companion.trim()}` : null,
    ].filter(Boolean);
    const characteristics = characteristicsParts.join(". ");

    if (!language && !transcript.trim() && characteristicsParts.length === 0) {
      setError("Please capture at least the language and one answer before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakePath: "B_elderly",
          role: "self_missing",
          timeReported: timeReported ? new Date(timeReported).toISOString() : undefined,
          location,
          language,
          region,
          ageRange,
          gender,
          characteristics: characteristics || "(captured via audio — see transcript)",
          transcript: transcript.trim() || null,
          reporterName: name || null,
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
        ← Back to intake
      </Link>
      <div className="mb-4 mt-2 flex items-center gap-3">
        <span className="text-4xl">🧓</span>
        <div>
          <h1 className="text-2xl font-extrabold text-teal-700">Elderly / Audio Assist</h1>
          <p className="text-sm text-slate-500">
            Tap a language, play each question aloud, and capture spoken answers.
          </p>
        </div>
      </div>

      {!supported.asr && (
        <div className="card mb-4 border-amber-300 bg-amber-50 text-sm text-amber-800">
          Voice capture isn&apos;t supported in this browser. You can still play
          questions aloud{!supported.tts ? " (also unsupported here)" : ""} and type
          the answers — the form works exactly the same.
        </div>
      )}

      {/* Step 1: language tiles */}
      <div className="card mb-4">
        <h2 className="mb-3 text-lg font-bold text-slate-700">1. Choose language</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => pickLanguage(l)}
              className={`tile !min-h-[5rem] !p-4 !text-lg ${
                language === l ? "border-teal-500 bg-teal-50" : ""
              }`}
            >
              🔊 {l}
            </button>
          ))}
        </div>
        {language && (
          <p className="mt-3 text-sm font-semibold text-teal-700">Selected: {language}</p>
        )}
      </div>

      {/* Step 2: spoken questions */}
      <div className="card mb-4">
        <h2 className="mb-3 text-lg font-bold text-slate-700">2. Ask questions</h2>
        <div className="space-y-4">
          {QUESTIONS.map((item) => (
            <div key={item.key} className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold text-slate-700">{item.q}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => speak(item.q)}
                  disabled={!supported.tts}
                >
                  ▶ Play aloud
                </button>
                {listeningKey === item.key ? (
                  <button type="button" className="btn-danger" onClick={stopListening}>
                    ■ Stop listening…
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => listen(item.key, item.q)}
                    disabled={!supported.asr}
                  >
                    🎤 Speak answer
                  </button>
                )}
              </div>
              <input
                className="input mt-2"
                placeholder="Answer (auto-filled by voice, or type here)"
                value={answers[item.key] ?? ""}
                onChange={(e) => setAnswer(item.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Step 3: review + structured fields */}
      <form onSubmit={submit} className="card space-y-4">
        <h2 className="text-lg font-bold text-slate-700">3. Review &amp; submit</h2>

        <TextAreaField
          label="Transcript (review & edit before submitting)"
          value={transcript}
          onChange={setTranscript}
          rows={6}
          hint="Captured spoken answers appear here. Correct anything that was misheard."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Time reported" value={timeReported} onChange={setTimeReported} type="datetime-local" />
          <LocationField label="Found / current location" value={location?.label ?? ""} onChange={setLocation} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Age range" value={ageRange} onChange={setAgeRange} options={AGE_RANGES} />
          <SelectField label="Gender" value={gender} onChange={setGender} options={GENDERS} />
          <SelectField label="Home region" value={region} onChange={setRegion} options={REGIONS} />
        </div>

        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

        <button type="submit" className="btn-primary w-full text-lg" disabled={submitting}>
          {submitting ? "Saving…" : "Create case & find matches"}
        </button>
      </form>
    </div>
  );
}
