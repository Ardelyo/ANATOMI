import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/** Daftar gejala (kamus). `slug` dipakai sebagai kunci di tabel penyakit. */
export const symptoms = pgTable("symptoms", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  region: text("region").notNull(),
});

/** Penyakit / kondisi, dengan struktur anatomi terkait (id bagian pada model 3D). */
export const conditions = pgTable("conditions", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  system: text("system").notNull(),
  severity: text("severity").notNull(),
  description: text("description").notNull(),
  advice: text("advice").notNull(),
  redFlags: text("red_flags").notNull(),
  symptoms: jsonb("symptoms").$type<string[]>().notNull(),
  structures: jsonb("structures").$type<string[]>().notNull(),
});

/** Skrip animasi / identifikasi yang disimpan pengguna. */
export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Penanda gejala yang ditempel pada titik tertentu di model. */
export const annotations = pgTable("annotations", {
  id: serial("id").primaryKey(),
  partId: text("part_id").notNull(),
  point: jsonb("point").$type<[number, number, number]>().notNull(),
  label: text("label").notNull(),
  note: text("note").notNull().default(""),
  severity: integer("severity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
