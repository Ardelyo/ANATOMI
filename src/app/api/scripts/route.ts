import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { scripts } from "@/db/schema";
import { ensureSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeed();
  return Response.json(await db.select().from(scripts).orderBy(desc(scripts.createdAt)));
}

export async function POST(req: Request) {
  await ensureSeed();
  const body = (await req.json().catch(() => null)) as { name?: string; code?: string } | null;
  const name = body?.name?.trim();
  const code = body?.code;
  if (!name || !code) return Response.json({ error: "name dan code wajib diisi" }, { status: 400 });
  const [row] = await db.insert(scripts).values({ name: name.slice(0, 80), code: code.slice(0, 20000) }).returning();
  return Response.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  await ensureSeed();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return Response.json({ error: "id tidak valid" }, { status: 400 });
  await db.delete(scripts).where(eq(scripts.id, id));
  return Response.json({ ok: true });
}
