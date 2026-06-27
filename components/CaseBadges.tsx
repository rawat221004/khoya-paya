import { T } from "@/components/LanguageProvider";
import type { Case } from "@/lib/types";

const STATUS_STYLE: Record<Case["status"], string> = {
  open: "bg-emerald-100 text-emerald-700",
  matched_pending: "bg-amber-100 text-amber-800",
  closed: "bg-slate-200 text-slate-600",
};

const STATUS_LABEL: Record<Case["status"], string> = {
  open: "Open",
  matched_pending: "Pending",
  closed: "Reunited",
};

const PATH_LABEL: Record<Case["intakePath"], string> = {
  A_child: "Path A · Child",
  B_elderly: "Path B · Elderly",
  C_standard: "Path C · Standard",
};

const ROLE_LABEL: Record<Case["role"], string> = {
  self_missing: "Self missing",
  reported: "Found / reported",
  reporter: "Reporter",
  other: "Other",
};

export function StatusBadge({ status }: { status: Case["status"] }) {
  return <span className={`badge ${STATUS_STYLE[status]}`}><T>{STATUS_LABEL[status]}</T></span>;
}

export function PathBadge({ path }: { path: Case["intakePath"] }) {
  return <span className="badge bg-teal-100 text-teal-700"><T>{PATH_LABEL[path]}</T></span>;
}

export function RoleBadge({ role }: { role: Case["role"] }) {
  return <span className="badge bg-sky-100 text-sky-700"><T>{ROLE_LABEL[role]}</T></span>;
}

export function confidenceColor(score: number): string {
  if (score >= 90) return "bg-emerald-500";
  if (score >= 70) return "bg-teal-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-slate-400";
}
