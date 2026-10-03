import { CONDITION_SEED, SYMPTOM_SEED } from "@/db/seed-data";

export interface ClientSymptom {
  id: number;
  slug: string;
  label: string;
  region: string;
}

export interface ClientCondition {
  id: number;
  slug: string;
  name: string;
  system: string;
  description: string;
  advice: string;
  redFlags: string;
  severity: "ringan" | "sedang" | "berat";
  structures: string[];
  symptoms: string[];
}

export interface ClientAnnotation {
  id: number;
  partId: string;
  point: [number, number, number];
  label: string;
  note: string;
  severity: number;
  createdAt: string;
}

export interface ClientScript {
  id: number;
  title: string;
  code: string;
  description?: string | null;
  createdAt: string;
}

const ALL_SYMPTOMS: ClientSymptom[] = SYMPTOM_SEED.map(([slug, label, region], i) => ({
  id: i + 1,
  slug,
  label,
  region,
}));

const ALL_CONDITIONS: ClientCondition[] = CONDITION_SEED.map((c, i) => ({
  id: i + 1,
  slug: c.slug,
  name: c.name,
  system: c.system,
  description: c.description,
  advice: c.advice,
  redFlags: c.redFlags,
  severity: c.severity,
  structures: c.structures,
  symptoms: c.symptoms,
}));

export async function getClientSymptoms(): Promise<ClientSymptom[]> {
  return ALL_SYMPTOMS;
}

export async function getClientConditions(keys?: string[]): Promise<ClientCondition[]> {
  if (!keys || keys.length === 0) return ALL_CONDITIONS;
  const set = new Set(keys.map((k) => k.toLowerCase()));
  return ALL_CONDITIONS.filter((c) =>
    c.structures.some((s) => set.has(s.toLowerCase())) ||
    set.has(c.slug.toLowerCase()) ||
    set.has(c.system.toLowerCase())
  );
}

export interface DiagnosisHitResult extends ClientCondition {
  score: number;
  matched: { slug: string; label: string }[];
  missing: { slug: string; label: string }[];
}

export async function clientDiagnose(chosenSlugs: string[]): Promise<DiagnosisHitResult[]> {
  if (!chosenSlugs || chosenSlugs.length === 0) return [];
  const chosen = new Set(chosenSlugs);

  const scored = ALL_CONDITIONS.map((cond) => {
    const matchedSlugs = cond.symptoms.filter((s) => chosen.has(s));
    if (matchedSlugs.length === 0) return null;

    const jaccard = matchedSlugs.length / (chosen.size + cond.symptoms.length - matchedSlugs.length);
    const recall = matchedSlugs.length / cond.symptoms.length;
    const precision = matchedSlugs.length / chosen.size;
    const score = Number((recall * 0.5 + precision * 0.3 + jaccard * 0.2).toFixed(3));

    const matched = matchedSlugs.map((slug) => ({ slug, label: slug }));
    const missing = cond.symptoms.filter((s) => !chosen.has(s)).map((slug) => ({ slug, label: slug }));

    return {
      ...cond,
      score,
      matched,
      missing,
    };
  }).filter(Boolean) as DiagnosisHitResult[];

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10);
}

// ───────────── PERSISTENSI ANOTASI & SKRIP (LOCAL STORAGE) ─────────────
const ANNOTATION_KEY = "anatomi_annotations_v1";
const SCRIPT_KEY = "anatomi_scripts_v1";

const DEFAULT_ANNOTATIONS: ClientAnnotation[] = [
  {
    id: 1,
    partId: "heart",
    point: [0.03, 1.25, 0.05],
    label: "Apeks Jantung (Pulsasi Miokardium)",
    note: "Pemeriksaan ictus cordis pada sela iga ke-5 linea midklavikularis sinistra.",
    severity: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 2,
    partId: "disc-L4-L5",
    point: [0.0, 0.98, -0.05],
    label: "Hernia Diskus L4-L5 (Saraf Terjepit)",
    note: "Penekanan radiks nervus iskiadikus bilateral dengan keluhan ischialgia.",
    severity: 3,
    createdAt: new Date().toISOString(),
  },
];

export function getClientAnnotations(): ClientAnnotation[] {
  if (typeof window === "undefined") return DEFAULT_ANNOTATIONS;
  try {
    const raw = localStorage.getItem(ANNOTATION_KEY);
    if (!raw) {
      localStorage.setItem(ANNOTATION_KEY, JSON.stringify(DEFAULT_ANNOTATIONS));
      return DEFAULT_ANNOTATIONS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_ANNOTATIONS;
  }
}

export function saveClientAnnotation(item: {
  partId: string;
  point: [number, number, number];
  label: string;
  note?: string;
  severity: number;
}): ClientAnnotation {
  const list = getClientAnnotations();
  const newRow: ClientAnnotation = {
    id: Date.now(),
    partId: item.partId,
    point: item.point,
    label: item.label,
    note: item.note ?? "",
    severity: item.severity,
    createdAt: new Date().toISOString(),
  };
  list.push(newRow);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ANNOTATION_KEY, JSON.stringify(list));
    } catch {}
  }
  return newRow;
}

export function deleteClientAnnotation(id: number): boolean {
  let list = getClientAnnotations();
  list = list.filter((x) => x.id !== id);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ANNOTATION_KEY, JSON.stringify(list));
    } catch {}
  }
  return true;
}

export function getClientScripts(): ClientScript[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SCRIPT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveClientScript(title: string, code: string, description?: string): ClientScript {
  const list = getClientScripts();
  const row: ClientScript = {
    id: Date.now(),
    title,
    code,
    description,
    createdAt: new Date().toISOString(),
  };
  list.unshift(row);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SCRIPT_KEY, JSON.stringify(list));
    } catch {}
  }
  return row;
}

export function deleteClientScript(id: number): boolean {
  let list = getClientScripts();
  list = list.filter((x) => x.id !== id);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SCRIPT_KEY, JSON.stringify(list));
    } catch {}
  }
  return true;
}
