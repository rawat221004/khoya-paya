"use client";

import Link from "next/link";

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
          <h2 className="text-lg font-bold text-teal-800">Case created</h2>
          <p className="text-sm text-teal-700">
            Case <span className="font-mono">{result.caseId}</span> was saved and
            scored against all open cases.
          </p>

          {result.candidates.length > 0 ? (
            <p className="mt-2 text-sm font-semibold text-teal-800">
              {result.candidates.length} potential match
              {result.candidates.length > 1 ? "es" : ""} found
              {top ? ` (top ${top.score}% confidence)` : ""}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-teal-700">
              No matches above threshold yet — this case will be re-scored as new
              cases arrive.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/cases/${result.caseId}`} className="btn-primary">
              View case &amp; matches →
            </Link>
            <button onClick={onReset} className="btn-secondary">
              Register another
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
