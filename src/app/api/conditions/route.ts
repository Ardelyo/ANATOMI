import { db } from "@/db";
import { conditions } from "@/db/schema";
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

/** GET /api/conditions?keys=heart,left-ventricle  -> penyakit yang menyentuh salah satu kunci struktur. */
export async function GET(req: Request) {
  await ensureSeed();
  const keys = new URL(req.url).searchParams.get("keys");
  const rows: ConditionRow[] = await db.select().from(conditions).orderBy(conditions.name);
  if (!keys) return Response.json(rows);
  const set = new Set(keys.split(",").map((k) => k.trim()).filter(Boolean));
  return Response.json(rows.filter((c: ConditionRow) => c.structures.some((s: string) => set.has(s))));
}
