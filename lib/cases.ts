// Server-side helpers for creating cases and running the matcher on creation.

import type { Low } from "lowdb";
import { newId } from "./db";
import { findCandidates, EXACT_MATCH_THRESHOLD } from "./matching";
import type { Case, DbData, MatchCandidate, PrincipalKind } from "./types";

export type NewCaseInput = {
  intakePath: Case["intakePath"];
  role: Case["role"];
  createdBy: string; // principal id (user id or booth id)
  creatorKind: PrincipalKind; // determines the audit-log attribution field
} & Partial<Omit<Case, "id" | "matchedCaseId" | "confidenceAtMatch">>;

export interface CreateOptions {
  // Skip candidate generation (used when bulk-importing already-resolved
  // historical records that should not produce review candidates).
  runMatching?: boolean;
  // Cap how many candidate rows are stored (keeps db.json bounded at scale).
  maxCandidates?: number;
}

/** Writes an audit entry attributed to the correct principal kind. */
function auditEntry(
  caseId: string,
  action: string,
  creatorKind: PrincipalKind,
  createdBy: string,
  timestamp: string
) {
  return {
    id: newId("audit"),
    caseId,
    action,
    ...(creatorKind === "booth"
      ? { byBoothId: createdBy }
      : { byUserId: createdBy }),
    timestamp,
  };
}

/**
 * Inserts a new case, runs findCandidates() against all open cases, stores the
 * resulting matchCandidates rows, and writes audit entries. Returns the created
 * case and the candidates generated for it. Caller is responsible for db.write().
 */
export function createCaseWithMatching(
  db: Low<DbData>,
  input: NewCaseInput,
  options: CreateOptions = {}
): { newCase: Case; candidates: MatchCandidate[] } {
  const { runMatching = true, maxCandidates = 15 } = options;
  const now = new Date().toISOString();
  const createdAt = input.createdAt || now;
  const newCase: Case = {
    id: newId("case"),
    status: input.status ?? "open",
    intakePath: input.intakePath,
    role: input.role,
    photoUrl: input.photoUrl ?? null,
    timeReported: input.timeReported || createdAt,
    location: input.location ?? null,
    language: input.language ?? null,
    region: input.region ?? null,
    ageRange: input.ageRange ?? null,
    gender: input.gender ?? null,
    characteristics: input.characteristics ?? null,
    reporterName: input.reporterName ?? null,
    reporterContact: input.reporterContact ?? null,
    rawTranscript: input.rawTranscript ?? null,
    structuredByClaude: input.structuredByClaude ?? false,
    boothId: input.boothId ?? null,
    boothName: input.boothName ?? null,
    createdBy: input.createdBy,
    createdAt,
    matchedCaseId: null,
    confidenceAtMatch: null,
    personName: input.personName ?? null,
    district: input.district ?? null,
    reportingCenter: input.reportingCenter ?? null,
    externalId: input.externalId ?? null,
    isDuplicate: input.isDuplicate ?? false,
    source: input.source ?? "manual",
  };

  db.data.cases.push(newCase);

  db.data.auditLog.push(
    auditEntry(
      newCase.id,
      newCase.source === "dataset"
        ? `Imported from Kumbh Mela 2027 dataset (${newCase.externalId ?? "n/a"}) via ${
            newCase.reportingCenter ?? "unknown center"
          }`
        : `Case created via ${pathLabel(newCase.intakePath)}${
            newCase.boothName ? ` at ${newCase.boothName}` : ""
          }`,
      input.creatorKind,
      newCase.createdBy,
      createdAt
    )
  );

  if (!runMatching) {
    return { newCase, candidates: [] };
  }

  // Run the matcher against the other open cases.
  const openCases = db.data.cases.filter(
    (c) => c.status === "open" && c.id !== newCase.id
  );
  const found = findCandidates(newCase, openCases).slice(0, maxCandidates);

  const candidates: MatchCandidate[] = found.map((cand) => ({
    id: newId("mc"),
    caseIdA: newCase.id,
    caseIdB: cand.caseId,
    score: cand.score,
    breakdown: cand.breakdown,
    createdAt: now,
  }));
  db.data.matchCandidates.push(...candidates);

  if (candidates.length > 0) {
    const best = candidates[0];
    const auto = best.score >= EXACT_MATCH_THRESHOLD;
    db.data.auditLog.push(
      auditEntry(
        newCase.id,
        auto
          ? `High-confidence match auto-suggested (${best.score}% vs case ${best.caseIdB})`
          : `${candidates.length} candidate(s) flagged for volunteer review (top ${best.score}%)`,
        input.creatorKind,
        newCase.createdBy,
        now
      )
    );
  }

  return { newCase, candidates };
}

function pathLabel(p: Case["intakePath"]): string {
  if (p === "A_child") return "Path A (Child / Unable proxy)";
  if (p === "B_elderly") return "Path B (Elderly audio + text)";
  return "Path C (Standard)";
}

/**
 * Returns all match candidates relevant to a case in BOTH directions
 * (where the case is A or B), de-duplicated by the other case id, keeping the
 * highest-scoring row. Only candidates whose other case is still open are kept.
 */
export function candidatesForCase(
  db: Low<DbData>,
  caseId: string
): Array<{ candidate: MatchCandidate; otherCase: Case }> {
  const byOther = new Map<string, MatchCandidate>();
  for (const mc of db.data.matchCandidates) {
    let otherId: string | null = null;
    if (mc.caseIdA === caseId) otherId = mc.caseIdB;
    else if (mc.caseIdB === caseId) otherId = mc.caseIdA;
    if (!otherId) continue;
    const existing = byOther.get(otherId);
    if (!existing || mc.score > existing.score) byOther.set(otherId, mc);
  }

  const out: Array<{ candidate: MatchCandidate; otherCase: Case }> = [];
  for (const [otherId, mc] of byOther) {
    const otherCase = db.data.cases.find((c) => c.id === otherId);
    if (!otherCase) continue;
    if (otherCase.status === "closed") continue;
    out.push({ candidate: mc, otherCase });
  }
  out.sort((a, b) => b.candidate.score - a.candidate.score);
  return out;
}
