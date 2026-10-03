import { sql } from "drizzle-orm";
import { db, hasDb } from "@/db";
import { conditions, symptoms } from "@/db/schema";
import { CONDITION_SEED, SYMPTOM_SEED } from "@/db/seed-data";

let seeding: Promise<void> | null = null;

/** Membuat tabel bila belum ada dan mengisi data awal (idempoten). */
export function ensureSeed(): Promise<void> {
  if (!hasDb) return Promise.resolve();
  if (!seeding) {
    seeding = run().catch((err) => {
      console.warn("[ANATOMI db seed] Fallback ke in-memory storage:", err?.message || err);
      return Promise.resolve();
    });
  }
  return seeding;
}

async function run() {
  try {
    await db.execute(sql`
      create table if not exists symptoms (
        slug text primary key, label text not null, region text not null
      )`);
    await db.execute(sql`
      create table if not exists conditions (
        id serial primary key, slug text not null unique, name text not null,
        system text not null, severity text not null, description text not null,
        advice text not null, red_flags text not null,
        symptoms jsonb not null, structures jsonb not null
      )`);
    await db.execute(sql`
      create table if not exists scripts (
        id serial primary key, name text not null, code text not null,
        created_at timestamp not null default now()
      )`);
    await db.execute(sql`
      create table if not exists annotations (
        id serial primary key, part_id text not null, point jsonb not null,
        label text not null, note text not null default '',
        severity integer not null default 1, created_at timestamp not null default now()
      )`);

    const [{ n }] = (await db.execute(sql`select count(*)::int as n from conditions`)).rows as { n: number }[];
    if (n === 0) {
      await db
        .insert(symptoms)
        .values(SYMPTOM_SEED.map(([slug, label, region]) => ({ slug, label, region })))
        .onConflictDoNothing();
      await db.insert(conditions).values(CONDITION_SEED).onConflictDoNothing();
    }
  } catch (err) {
    console.warn("[ANATOMI db seed] Tidak dapat terhubung ke PostgreSQL, menggunakan data offline lokal:", err);
  }
}
