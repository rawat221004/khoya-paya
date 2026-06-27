"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  SelectField,
  TextField,
  TextAreaField,
  LocationField,
  PhotoUpload,
} from "@/components/Fields";
import IntakeResult, { CreatedResult } from "@/components/IntakeResult";
import { T, useLang } from "@/components/LanguageProvider";
import { AGE_RANGES, GENDERS, LANGUAGES, REGIONS, LOCATIONS } from "@/lib/constants";

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
  Maithili: "hi-IN",
  Bhojpuri: "hi-IN",
  Awadhi: "hi-IN",
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
  // UI-chrome translator (volunteer's interface language, from the navbar).
  const { get } = useLang();

  // The elderly person's chosen intake language (separate from the UI chrome).
  const [language, setLanguage] = useState("");
  const [supported, setSupported] = useState({ tts: false, asr: false });
  const [listeningKey, setListeningKey] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [rawTranscript, setRawTranscript] = useState("");
  // Question prompts translated into the chosen intake language (shown + spoken).
  const [questionText, setQuestionText] = useState<Record<string, string>>(() =>
    Object.fromEntries(QUESTIONS.map((q) => [q.key, q.q]))
  );
  const [translatingQ, setTranslatingQ] = useState(false);

  const [timeReported, setTimeReported] = useState(nowLocal());
  const [location, setLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [ageRange, setAgeRange] = useState("71-80");
  const [gender, setGender] = useState("");
  const [region, setRegion] = useState("");
  const [characteristics, setCharacteristics] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const [structuring, setStructuring] = useState(false);
  const [structuredByClaude, setStructuredByClaude] = useState(false);
  const [structureNote, setStructureNote] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedResult | null>(null);

  const recognitionRef = useRef<any>(null);
  // Set when a language is picked via its 🔊 button, so the auto-play effect
  // doesn't immediately cut off the spoken language name with the first question.
  const skipQuestionAutoplay = useRef(false);

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

  function speakLang(lang: string) {
    if (!supported.tts) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(lang);
    u.lang = SPEECH_LANG[lang] || "en-IN";
    window.speechSynthesis.speak(u);
  }

  // Selecting a language reveals the questions; the first question is then
  // auto-played by the effect below (spec: each question is shown as text AND
  // spoken). When the 🔊 button is used we speak the language name instead and
  // skip the question auto-play once so the name isn't cut off.
  function pickLanguage(lang: string, alsoSpeak: boolean) {
    if (alsoSpeak) skipQuestionAutoplay.current = true;
    setLanguage(lang);
    if (alsoSpeak) speakLang(lang);
  }

  // When the intake language changes, translate the question prompts into it so
  // the elderly person reads AND hears them in their own language. Uses Claude
  // (/api/ai/translate-ui); with no key it returns English (graceful).
  useEffect(() => {
    if (!language || language === "English") {
      setQuestionText(Object.fromEntries(QUESTIONS.map((q) => [q.key, q.q])));
      return;
    }
    let cancelled = false;
    setTranslatingQ(true);
    (async () => {
      try {
        const res = await fetch("/api/ai/translate-ui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: QUESTIONS.map((q) => q.q), targetLang: language }),
        });
        const data = await res.json();
        const tr: string[] = data.translations ?? QUESTIONS.map((q) => q.q);
        if (cancelled) return;
        setQuestionText(Object.fromEntries(QUESTIONS.map((q, i) => [q.key, tr[i] ?? q.q])));
      } catch {
        if (!cancelled) setQuestionText(Object.fromEntries(QUESTIONS.map((q) => [q.key, q.q])));
      } finally {
        if (!cancelled) setTranslatingQ(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Auto-play the first question once it is ready (in the intake language).
  // Fires when the (translated) question text settles, unless the language was
  // picked via its 🔊 button (then we let the spoken language name finish).
  useEffect(() => {
    if (!language || !supported.tts) return;
    if (skipQuestionAutoplay.current) {
      skipQuestionAutoplay.current = false;
      return;
    }
    speak(questionText[QUESTIONS[0].key]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionText, supported.tts]);

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
      // Auto-fill the home region if a known one was spoken.
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

  // Compiles the spoken/typed answers into a single raw transcript string.
  function compileTranscript(): string {
    const lines = QUESTIONS.map((item) => {
      const a = answers[item.key]?.trim();
      return a ? `Q: ${item.q}\nA: ${a}` : null;
    }).filter(Boolean);
    return lines.join("\n");
  }

  // Sends the raw answers to /api/ai/structure-transcript and prefills the form.
  async function autoStructure() {
    setError(null);
    const transcript = rawTranscript.trim() || compileTranscript();
    if (!transcript) {
      setError("Capture at least one answer (by voice or typing) before auto-filling.");
      return;
    }
    setRawTranscript(transcript);
    setStructuring(true);
    try {
      const res = await fetch("/api/ai/structure-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawTranscript: transcript, language }),
      });
      const data = await res.json();
      const s = data.structured ?? {};
      if (s.ageRange && AGE_RANGES.includes(s.ageRange)) setAgeRange(s.ageRange);
      if (s.gender && GENDERS.includes(s.gender)) setGender(s.gender);
      if (s.language && LANGUAGES.includes(s.language) && !language) setLanguage(s.language);
      if (s.region && REGIONS.includes(s.region)) setRegion(s.region);
      if (s.locationHint) {
        const loc = LOCATIONS.find(
          (l) => l.label.toLowerCase() === String(s.locationHint).toLowerCase()
        );
        if (loc) setLocation(loc);
      }
      if (s.characteristics) setCharacteristics(s.characteristics);
      setStructuredByClaude(Boolean(data.usedClaude));
      setStructureNote(
        data.usedClaude
          ? "Fields auto-filled by Claude from the answers. Review and correct anything below before submitting."
          : "Fields auto-filled by the built-in extractor (no API key set). Review and correct anything below before submitting."
      );
    } catch {
      setError("Could not auto-structure — you can still fill the fields manually.");
    } finally {
      setStructuring(false);
      // Either way the volunteer has now seen the (auto-filled) fields to review.
      setReviewed(true);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setAnswers({});
    setRawTranscript("");
    setCharacteristics("");
    setGender("");
    setRegion("");
    setLocation(null);
    setPhotoUrl(null);
    setStructuredByClaude(false);
    setStructureNote(null);
    setReviewed(false);
  }

  // Whether the next submit press will auto-fill+pause for review, or create.
  const willAutoFillFirst =
    !reviewed && Boolean(rawTranscript.trim() || Object.values(answers).some((a) => a?.trim()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const transcript = rawTranscript.trim() || compileTranscript();
    const name = answers.name?.trim();

    if (!language && !transcript && !characteristics.trim()) {
      setError("Please capture at least the language and one answer before submitting.");
      return;
    }

    // Spec: right before submit, send the combined raw answers to
    // structure-transcript to auto-fill the form, then let the volunteer review
    // and correct before the FINAL submit. If there is a transcript and it
    // hasn't been structured yet, do that now and pause so the fields can be
    // reviewed — the next press creates the case.
    if (transcript && !reviewed) {
      await autoStructure();
      return;
    }

    // Build a human-readable description if the volunteer didn't fill one.
    let desc = characteristics.trim();
    if (!desc) {
      desc = [
        name ? `Name: ${name}` : null,
        answers.appearance?.trim() ? `Wearing: ${answers.appearance.trim()}` : null,
        answers.companion?.trim() ? `Looking for / came with: ${answers.companion.trim()}` : null,
      ]
        .filter(Boolean)
        .join(". ");
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
          characteristics: desc || "(captured via audio — see transcript)",
          photoUrl,
          rawTranscript: transcript || null,
          structuredByClaude,
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
        ← <T>Back to intake</T>
      </Link>
      <div className="mb-4 mt-2 flex items-center gap-3">
        <span className="text-4xl">🧓</span>
        <div>
          <h1 className="text-2xl font-extrabold text-teal-700"><T>Elderly / Audio + Text Assist</T></h1>
          <p className="text-sm text-slate-500">
            <T>Every step works by voice and by typing — use whichever the person can manage.</T>
          </p>
        </div>
      </div>

      {(!supported.asr || !supported.tts) && (
        <div className="card mb-4 border-amber-300 bg-amber-50 text-sm text-amber-800">
          {!supported.asr && !supported.tts ? (
            <T>This browser supports neither voice playback nor voice capture — the screen works as a normal text form.</T>
          ) : !supported.asr ? (
            <T>Voice capture isn&apos;t supported here, but you can still play questions aloud and type the answers.</T>
          ) : (
            <T>Voice playback isn&apos;t supported here, but you can still capture spoken answers and type.</T>
          )}
        </div>
      )}

      {/* Step 1: language tiles — text + icon, plus a dedicated audio button */}
      <div className="card mb-4">
        <h2 className="mb-3 text-lg font-bold text-slate-700"><T>1. Choose language</T></h2>
        <p className="mb-3 text-xs text-slate-400">
          <T>Tap the language name to select it, or tap 🔊 to hear it read aloud (both select it).</T>
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {LANGUAGES.map((l) => (
            <div
              key={l}
              className={`flex items-center justify-between rounded-2xl border-2 p-3 transition ${
                language === l
                  ? "border-teal-500 bg-teal-50"
                  : "border-teal-200 hover:border-teal-400"
              }`}
            >
              <button
                type="button"
                onClick={() => pickLanguage(l, false)}
                className="flex-1 text-left text-lg font-bold text-teal-700"
              >
                🗣 {l}
              </button>
              <button
                type="button"
                onClick={() => pickLanguage(l, true)}
                disabled={!supported.tts}
                title={get("Hear it aloud")}
                className="ml-2 rounded-lg bg-teal-100 px-3 py-2 text-lg text-teal-700 hover:bg-teal-200 disabled:opacity-40"
              >
                🔊
              </button>
            </div>
          ))}
        </div>
        {language && (
          <p className="mt-3 text-sm font-semibold text-teal-700">
            <T>Selected:</T> {language}
            {translatingQ && <span className="ml-2 text-slate-400">({get("translating questions…")})</span>}
          </p>
        )}
      </div>

      {/* Step 2: questions — shown as text, spoken aloud, answered by voice OR typing */}
      <div className="card mb-4">
        <h2 className="mb-3 text-lg font-bold text-slate-700"><T>2. Ask the questions</T></h2>
        <div className="space-y-4">
          {QUESTIONS.map((item) => {
            const qText = questionText[item.key] ?? item.q;
            return (
            <div key={item.key} className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold text-slate-700">{qText}</p>
              {language && language !== "English" && qText !== item.q && (
                <p className="text-xs text-slate-400">{item.q}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => speak(qText)}
                  disabled={!supported.tts}
                >
                  ▶ <T>Play question aloud</T>
                </button>
                {listeningKey === item.key ? (
                  <button type="button" className="btn-danger" onClick={stopListening}>
                    ■ <T>Stop listening…</T>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => listen(item.key, qText)}
                    disabled={!supported.asr}
                  >
                    🎤 <T>Speak answer</T>
                  </button>
                )}
              </div>
              <input
                className="input mt-2"
                placeholder={get("Answer — captured by voice, or type here")}
                value={answers[item.key] ?? ""}
                onFocus={() => speak(qText)}
                onChange={(e) => setAnswer(item.key, e.target.value)}
              />
            </div>
            );
          })}
        </div>
      </div>

      {/* Step 3: auto-structure + review + submit */}
      <form onSubmit={submit} className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-700"><T>3. Review &amp; submit</T></h2>
          <button
            type="button"
            className="btn-secondary"
            onClick={autoStructure}
            disabled={structuring}
          >
            {structuring ? <T>Auto-filling…</T> : <T>✨ Auto-fill form from answers</T>}
          </button>
        </div>

        {structureNote && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              structuredByClaude
                ? "bg-teal-50 text-teal-800"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {structuredByClaude ? "✨ " : "⚙ "}
            <T>{structureNote}</T>
          </div>
        )}

        <TextAreaField
          label="Raw transcript (review & edit before submitting)"
          value={rawTranscript}
          onChange={setRawTranscript}
          rows={5}
          hint="The unedited spoken/typed answers. Tap 'Auto-fill' to extract the fields below from this."
        />

        <TextAreaField
          label="Characteristics / description"
          value={characteristics}
          onChange={setCharacteristics}
          rows={3}
          placeholder="Clothing colour, build, distinctive marks…"
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

        <PhotoUpload value={photoUrl} onChange={setPhotoUrl} />

        {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700"><T>{error}</T></div>}

        <button type="submit" className="btn-primary w-full text-lg" disabled={submitting || structuring}>
          {submitting ? (
            <T>Saving…</T>
          ) : structuring ? (
            <T>Auto-filling…</T>
          ) : willAutoFillFirst ? (
            <T>✨ Auto-fill from answers, then review →</T>
          ) : (
            <T>Create case &amp; find matches</T>
          )}
        </button>
      </form>
    </div>
  );
}
