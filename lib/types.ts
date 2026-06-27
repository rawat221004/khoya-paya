// Shared data model types for Kumbh Setu.

export type Role = "admin" | "volunteer" | "police";

export type CaseStatus = "open" | "matched_pending" | "closed";

export type IntakePath = "A_child" | "B_elderly" | "C_standard";

// The person-role for a case: who is reporting about whom.
export type CaseRole = "self_missing" | "reported" | "reporter" | "other";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: Role;
  name: string;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface Case {
  id: string;
  status: CaseStatus;
  intakePath: IntakePath;
  role: CaseRole;
  photoUrl: string | null;
  timeReported: string; // ISO timestamp of when person was last seen / reported
  location: GeoPoint | null;
  language: string | null;
  region: string | null;
  ageRange: string | null;
  gender: string | null;
  characteristics: string | null;
  reporterName: string | null;
  reporterContact: string | null;
  transcript: string | null; // for path B (elderly audio capture)
  createdBy: string; // user id
  createdAt: string;
  matchedCaseId: string | null;
  confidenceAtMatch: number | null;

  // Optional fields carried from the Kumbh Mela 2027 dataset import. All
  // optional so hand-created cases and the matching engine are unaffected.
  personName?: string | null; // name of the missing person (often blank)
  district?: string | null; // district of origin
  reportingCenter?: string | null; // which lost-and-found center filed it
  externalId?: string | null; // original KMP-2027-XXXXX id
  isDuplicate?: boolean; // dataset flag: same person reported at multiple centers
  source?: "manual" | "dataset"; // provenance
}

export interface MatchCandidate {
  id: string;
  caseIdA: string; // the (newer) case the candidate was generated for
  caseIdB: string; // the matched-against case
  score: number;
  breakdown: string[];
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  caseId: string;
  action: string;
  byUserId: string;
  timestamp: string;
}

export interface DbData {
  users: User[];
  cases: Case[];
  matchCandidates: MatchCandidate[];
  auditLog: AuditEntry[];
  sessions: Session[];
}
