"use client";

import { useState } from "react";
import { LOCATIONS } from "@/lib/constants";
import { T, useLang } from "@/components/LanguageProvider";

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="label"><T>{label}</T></label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400"><T>{hint}</T></p>}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = "— select —",
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  hint?: string;
}) {
  const { get } = useLang();
  return (
    <Field label={label} hint={hint}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{get(placeholder)}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  const { get } = useLang();
  return (
    <Field label={label} hint={hint}>
      <input
        type={type}
        className="input"
        value={value}
        placeholder={placeholder ? get(placeholder) : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  hint?: string;
}) {
  const { get } = useLang();
  return (
    <Field label={label} hint={hint}>
      <textarea
        className="input"
        rows={rows}
        value={value}
        placeholder={placeholder ? get(placeholder) : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** Location dropdown that returns the full {lat,lng,label} object. */
export function LocationField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // label
  onChange: (loc: { lat: number; lng: number; label: string } | null) => void;
}) {
  const { get } = useLang();
  return (
    <Field label={label}>
      <select
        className="input"
        value={value}
        onChange={(e) => {
          const loc = LOCATIONS.find((l) => l.label === e.target.value) ?? null;
          onChange(loc);
        }}
      >
        <option value="">{get("— select location —")}</option>
        {LOCATIONS.map((l) => (
          <option key={l.label} value={l.label}>
            {l.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** Photo upload that posts to /api/upload and returns the saved URL. */
export function PhotoUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label="Photo (optional)">
      <input type="file" accept="image/*" onChange={handle} className="block w-full text-sm" />
      {uploading && <p className="mt-1 text-xs text-teal-600"><T>Uploading…</T></p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt="uploaded"
          className="mt-2 h-28 w-28 rounded-lg border border-slate-200 object-cover"
        />
      )}
    </Field>
  );
}
