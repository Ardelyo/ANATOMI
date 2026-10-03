import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { annotations } from "@/db/schema";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  return Response.json(await db.select().from(annotations).orderBy(asc(annotations.createdAt)));
}

export async function POST(req: Request) {
  await ensureSeed();
  const b = (await req.json().catch(() => null)) as {
    partId?: string;
    point?: number[];
    label?: string;
    note?: string;
    severity?: number;
  } | null;
  if (!b?.partId || !b.label?.trim() || !Array.isArray(b.point) || b.point.length !== 3 || !b.point.every(Number.isFinite)) {
    return Response.json({ error: "data penanda tidak lengkap" }, { status: 400 });
  }
  const severity = Math.min(3, Math.max(1, Math.round(b.severity ?? 1)));
  const [row] = await db
    .insert(annotations)
    .values({
      partId: b.partId,
      point: [b.point[0], b.point[1], b.point[2]],
      label: b.label.trim().slice(0, 80),
      note: (b.note ?? "").slice(0, 400),
      severity,
    })
    .returning();
  return Response.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  await ensureSeed();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "id tidak valid" }, { status: 400 });
  await db.delete(annotations).where(eq(annotations.id, id));
  return Response.json({ ok: true });
}
