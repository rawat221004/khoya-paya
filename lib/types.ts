// Shared data model types for Khoya Paya.

// Staff users log in with a personal account; a booth IS a login (used by
// whichever volunteer is stationed there that shift). So there are two principal
// kinds. For route-gating purposes a booth carries the synthetic role "booth".
export type StaffRole = "admin" | "police" | "volunteer";
export type PrincipalRole = "admin" | "police" | "booth" | "volunteer";
export type PrincipalKind = "user" | "booth";

export type CaseStatus = "open" | "matched_pending" | "closed";

export type IntakePath = "A_child" | "B_elderly" | "C_standard";

// The person-role for a case: who is reporting about whom.
export type CaseRole = "self_missing" | "reported" | "reporter" | "other";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  role: StaffRole;
  name: string;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

// A booth is both a physical intake station and a login account. Every case
// created during a booth session is stamped with the booth id/name/location so
// the dashboard can show a hotspot-by-booth breakdown.
export interface Booth {
  id: string;
  username: string;
  passwordHash: string;
  name: string;
  location: GeoPoint;
}

export interface Session {
  id: string;
  principalId: string; // user id OR booth id
  kind: PrincipalKind;
  createdAt: string;
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
  rawTranscript: string | null; // unedited spoken/typed answers, Path B
  structuredByClaude: boolean; // true if Claude parsed the transcript into fields
  boothId: string | null; // which booth logged this in
  boothName: string | null;
  createdBy: string; // principal id (user id or booth id) that created the case
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
  byUserId?: string; // set when a staff user performed the action
  byBoothId?: string; // set when a booth session performed the action
  timestamp: string;
}

// A single CCTV camera "sighting" on a tracking trail.
export interface CctvSighting {
  cameraId: string;
  lat: number;
  lng: number;
  distanceKm: number;
  timestamp: string; // when the subject was (estimated to be) seen at this camera
  confidence: number; // 0-100, decays along the trail
  note: string; // short human-readable line, e.g. appearance recap
}

// The result of tracing a case's subject across the CCTV network.
export interface CctvTrack {
  id: string;
  caseId: string;
  createdAt: string;
  appearance: string; // appearance descriptor used for matching
  usedVision: boolean; // true if the photo was analysed by Claude vision
  sightings: CctvSighting[];
}

export interface DbData {
  users: User[];
  booths: Booth[];
  cases: Case[];
  matchCandidates: MatchCandidate[];
  auditLog: AuditEntry[];
  sessions: Session[];
  cctvTracks: CctvTrack[];
}
