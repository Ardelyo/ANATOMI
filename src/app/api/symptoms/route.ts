import { db } from "@/db";
import { symptoms } from "@/db/schema";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  const rows = await db.select().from(symptoms).orderBy(symptoms.region, symptoms.label);
  return Response.json(rows);
}
