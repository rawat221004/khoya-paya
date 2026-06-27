"use client";

// App-wide multilingual support, powered by Claude.
//
// Wrap any visible UI string in <T>...</T>. When the user picks a language from
// the navbar switcher, every <T> string is translated into that language via
// /api/ai/translate-ui (batched + cached in localStorage), and the UI re-renders
// live. With no ANTHROPIC_API_KEY the endpoint returns the originals, so the app
// stays in English and nothing breaks. The same selected language drives the
// built-in text-to-speech (speak()), so the interface can be read aloud.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// English first; the rest mirror lib/constants LANGUAGES.
export const UI_LANGUAGES = [
  "English",
  "Hindi",
  "Marathi",
  "Gujarati",
  "Bengali",
  "Telugu",
  "Tamil",
  "Kannada",
  "Maithili",
  "Bhojpuri",
  "Awadhi",
  "Punjabi",
  "Nepali",
  "Malayalam",
];

// BCP-47 codes for SpeechSynthesis per language.
const SPEECH_LANG: Record<string, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Marathi: "mr-IN",
  Gujarati: "gu-IN",
  Bengali: "bn-IN",
  Telugu: "te-IN",
  Tamil: "ta-IN",
  Kannada: "kn-IN",
  Maithili: "hi-IN",
  Bhojpuri: "hi-IN",
  Awadhi: "hi-IN",
  Punjabi: "pa-IN",
  Nepali: "ne-NP",
  Malayalam: "ml-IN",
};

const LANG_KEY = "kumbh_ui_lang";
const DICT_KEY = "kumbh_ui_dict";

type Dict = Record<string, Record<string, string>>; // lang -> (source -> translated)

interface LangContextValue {
  lang: string;
  setLang: (l: string) => void;
  /** Returns the cached translation for `text`, or the original. Pure read. */
  get: (text: string) => string;
  /** Queues `text` for translation in the current language (no-op for English). */
  request: (text: string) => void;
  /** Speaks `text` aloud in the current language (Web Speech API). */
  speak: (text: string) => void;
  speaking: boolean;
  ttsSupported: boolean;
  translating: boolean;
}

const LangContext = createContext<LangContextValue | null>(null);

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Safe no-op fallback if a <T> is rendered outside the provider.
    return {
      lang: "English",
      setLang: () => {},
      get: (t) => t,
      request: () => {},
      speak: () => {},
      speaking: false,
      ttsSupported: false,
      translating: false,
    };
  }
  return ctx;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState("English");
  const [dict, setDict] = useState<Dict>({});
  const [translating, setTranslating] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  // Latest dict without changing callback identity.
  const dictRef = useRef<Dict>({});
  dictRef.current = dict;

  const pendingRef = useRef<Set<string>>(new Set());
  const [flush, setFlush] = useState(0);

  // Load persisted language + cache once on mount.
  useEffect(() => {
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    try {
      const savedLang = localStorage.getItem(LANG_KEY);
      if (savedLang) setLangState(savedLang);
      const savedDict = localStorage.getItem(DICT_KEY);
      if (savedDict) setDict(JSON.parse(savedDict));
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  const setLang = useCallback((l: string) => {
    pendingRef.current.clear();
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const get = useCallback((text: string): string => {
    if (lang === "English") return text;
    return dictRef.current[lang]?.[text] ?? text;
  }, [lang]);

  const request = useCallback(
    (text: string) => {
      if (!text || lang === "English") return;
      if (dictRef.current[lang]?.[text] !== undefined) return;
      if (pendingRef.current.has(text)) return;
      pendingRef.current.add(text);
      // Coalesce: bump a counter so the flush effect runs once for this batch.
      setFlush((f) => f + 1);
    },
    [lang]
  );

  // Batch-translate everything queued since the last flush.
  useEffect(() => {
    if (lang === "English") return;
    const batch = Array.from(pendingRef.current);
    if (batch.length === 0) return;
    pendingRef.current.clear();
    let cancelled = false;
    setTranslating(true);
    (async () => {
      try {
        const res = await fetch("/api/ai/translate-ui", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: batch, targetLang: lang }),
        });
        const data = await res.json();
        const translations: string[] = data.translations ?? batch;
        if (cancelled) return;
        setDict((prev) => {
          const next: Dict = { ...prev, [lang]: { ...(prev[lang] ?? {}) } };
          batch.forEach((src, i) => {
            next[lang][src] = translations[i] ?? src;
          });
          try {
            localStorage.setItem(DICT_KEY, JSON.stringify(next));
          } catch {
            /* storage may be full; in-memory cache still works */
          }
          return next;
        });
      } catch {
        /* leave originals; they'll be re-requested on next render */
      } finally {
        if (!cancelled) setTranslating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush, lang]);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const toSay = lang === "English" ? text : dictRef.current[lang]?.[text] ?? text;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(toSay);
      u.lang = SPEECH_LANG[lang] || "en-IN";
      u.rate = 0.95;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [lang]
  );

  return (
    <LangContext.Provider
      value={{ lang, setLang, get, request, speak, speaking, ttsSupported, translating }}
    >
      {children}
    </LangContext.Provider>
  );
}

/**
 * Translates its (string) children into the current UI language. Shows the
 * English original until the translation arrives, then updates live.
 */
export function T({ children }: { children: string }) {
  const { get, request, lang } = useLang();
  useEffect(() => {
    request(children);
  }, [children, lang, request]);
  return <>{get(children)}</>;
}
