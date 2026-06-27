"use client";

import Link from "next/link";
import { T } from "@/components/LanguageProvider";

export interface CreatedResult {
  caseId: string;
  candidates: Array<{ score: number; caseIdB: string }>;
}

export default function IntakeResult({
  result,
  onReset,
}: {
  result: CreatedResult;
  onReset: () => void;
}) {
  const top = result.candidates[0];
  return (
    <div className="card border-teal-300 bg-teal-50">
      <div className="flex items-start gap-3">
        <span className="text-3xl">✅</span>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-teal-800"><T>Case created</T></h2>
          <p className="text-sm text-teal-700">
            <T>Case</T> <span className="font-mono">{result.caseId}</span>{" "}
            <T>was saved and scored against all open cases.</T>
          </p>

          {result.candidates.length > 0 ? (
            <p className="mt-2 text-sm font-semibold text-teal-800">
              {result.candidates.length} potential match
              {result.candidates.length > 1 ? "es" : ""} found
              {top ? ` (top ${top.score}% confidence)` : ""}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-teal-700">
              <T>No matches above threshold yet — this case will be re-scored as new cases arrive.</T>
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/cases/${result.caseId}`} className="btn-primary">
              <T>View case &amp; matches →</T>
            </Link>
            <button onClick={onReset} className="btn-secondary">
              <T>Register another</T>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
