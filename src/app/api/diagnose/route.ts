import { db } from "@/db";
import { conditions, symptoms } from "@/db/schema";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

interface ConditionRow {
  id: number;
  slug: string;
  name: string;
  system: string;
  severity: string;
  description: string;
  advice: string;
  redFlags: string;
  symptoms: string[];
  structures: string[];
}

interface SymptomRow {
  slug: string;
  label: string;
  region: string;
}

/**
 * POST /api/diagnose  { symptoms: string[] }
 * Mencocokkan gejala dengan basis pengetahuan dan mengurutkan kemungkinan kondisi.
 * Ini alat edukasi, bukan diagnosis medis.
 */
export async function POST(req: Request) {
  await ensureSeed();
  const body = (await req.json().catch(() => ({}))) as { symptoms?: unknown };
  const chosen = Array.isArray(body.symptoms) ? body.symptoms.filter((s): s is string => typeof s === "string") : [];
  if (chosen.length === 0) return Response.json({ results: [] });

  const [rawRows, rawDict] = await Promise.all([db.select().from(conditions), db.select().from(symptoms)]);
  const rows = rawRows as ConditionRow[];
  const dict = rawDict as SymptomRow[];

  const labels = new Map(dict.map((s: SymptomRow) => [s.slug, s.label]));
  const sel = new Set(chosen);

  const results = rows
    .map((c: ConditionRow) => {
      const matched = c.symptoms.filter((s: string) => sel.has(s));
      if (matched.length === 0) return null;
      const coverage = matched.length / sel.size;
      const specificity = matched.length / c.symptoms.length;
      const score = 0.65 * coverage + 0.35 * specificity;
      return {
        ...c,
        score: Math.round(score * 100) / 100,
        matched: matched.map((s: string) => ({ slug: s, label: labels.get(s) ?? s })),
        missing: c.symptoms.filter((s: string) => !sel.has(s)).map((s: string) => ({ slug: s, label: labels.get(s) ?? s })),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return Response.json({ results });
}
