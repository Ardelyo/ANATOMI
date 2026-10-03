export interface Condition {
  id: number;
  slug: string;
  name: string;
  system: string;
  severity: "ringan" | "sedang" | "berat";
  description: string;
  advice: string;
  redFlags: string;
  symptoms: string[];
  structures: string[];
}

export interface Symptom {
  slug: string;
  label: string;
  region: string;
}

export interface DiagnoseHit extends Condition {
  score: number;
  matched: { slug: string; label: string }[];
  missing: { slug: string; label: string }[];
}

export interface Annotation {
  id: number;
  partId: string;
  point: [number, number, number];
  label: string;
  note: string;
  severity: number;
}

export interface SavedScript {
  id: number;
  name: string;
  code: string;
}

export type Tab = "info" | "symptoms" | "script";

export const SEVERITY_STYLE: Record<string, string> = {
  ringan: "bg-tint text-accent-deep",
  sedang: "bg-warn-bg text-warn",
  berat: "bg-danger-bg text-danger",
};
