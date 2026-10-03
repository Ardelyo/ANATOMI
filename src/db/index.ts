import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { CONDITION_SEED, SYMPTOM_SEED } from "./seed-data";

const databaseUrl = process.env.DATABASE_URL;

interface MemRecord {
  id: number;
  [key: string]: unknown;
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __memAnnotations?: MemRecord[];
  __memScripts?: MemRecord[];
  __annotIdCounter?: number;
  __scriptIdCounter?: number;
};

if (!globalForDb.__memAnnotations) globalForDb.__memAnnotations = [];
if (!globalForDb.__memScripts) globalForDb.__memScripts = [];
if (!globalForDb.__annotIdCounter) globalForDb.__annotIdCounter = 1;
if (!globalForDb.__scriptIdCounter) globalForDb.__scriptIdCounter = 1;

export const hasDb = Boolean(databaseUrl);

export const pool = databaseUrl
  ? globalForDb.__arenaNextJsPostgresqlPool ??
    new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 2000,
    })
  : null;

if (pool && process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

const inMemorySymptoms = SYMPTOM_SEED.map(([slug, label, region]) => ({ slug, label, region }));
const inMemoryConditions = CONDITION_SEED.map((c, i) => ({ id: i + 1, ...c }));

function getTableName(table: unknown): string {
  if (!table) return "unknown";
  const t = table as { _?: { name?: string }; name?: string };
  return t._?.name || t.name || "unknown";
}

// In-memory fallback mock yang kompatibel dengan Drizzle queries pada aplikasi ini
const memDb = {
  select: () => ({
    from: (table: unknown) => {
      const tableName = getTableName(table);
      let data: unknown[] = [];
      if (tableName === "symptoms") data = [...inMemorySymptoms];
      else if (tableName === "conditions") data = [...inMemoryConditions];
      else if (tableName === "annotations") data = [...(globalForDb.__memAnnotations ?? [])];
      else if (tableName === "scripts") data = [...(globalForDb.__memScripts ?? [])];

      return {
        orderBy: () => Promise.resolve(data),
        then: (onfulfilled?: (val: unknown[]) => unknown) => Promise.resolve(data).then(onfulfilled),
        catch: (onrejected?: (reason: unknown) => unknown) => Promise.resolve(data).catch(onrejected),
      };
    },
  }),
  insert: (table: unknown) => ({
    values: (val: Record<string, unknown> | Record<string, unknown>[]) => {
      const tableName = getTableName(table);
      const items = Array.isArray(val) ? val : [val];
      const inserted: MemRecord[] = [];

      for (const item of items) {
        if (tableName === "annotations") {
          const row: MemRecord = {
            id: (globalForDb.__annotIdCounter = (globalForDb.__annotIdCounter ?? 0) + 1),
            createdAt: new Date(),
            ...item,
          };
          globalForDb.__memAnnotations?.push(row);
          inserted.push(row);
        } else if (tableName === "scripts") {
          const row: MemRecord = {
            id: (globalForDb.__scriptIdCounter = (globalForDb.__scriptIdCounter ?? 0) + 1),
            createdAt: new Date(),
            ...item,
          };
          globalForDb.__memScripts?.push(row);
          inserted.push(row);
        } else {
          inserted.push({ id: 1, ...item });
        }
      }

      return {
        returning: () => Promise.resolve(inserted),
        onConflictDoNothing: () => Promise.resolve(),
        then: (onfulfilled?: (val: unknown[]) => unknown) => Promise.resolve(inserted).then(onfulfilled),
      };
    },
  }),
  delete: (table: unknown) => ({
    where: (cond: unknown) => {
      const tableName = getTableName(table);
      // parse id condition if possible
      try {
        const c = cond as { value?: number };
        const id = c?.value;
        if (typeof id === "number") {
          if (tableName === "annotations" && globalForDb.__memAnnotations) {
            globalForDb.__memAnnotations = globalForDb.__memAnnotations.filter((x) => x.id !== id);
          } else if (tableName === "scripts" && globalForDb.__memScripts) {
            globalForDb.__memScripts = globalForDb.__memScripts.filter((x) => x.id !== id);
          }
        }
      } catch {
        // ignore
      }
      return Promise.resolve({ ok: true });
    },
  }),
  execute: () => Promise.resolve({ rows: [{ n: inMemoryConditions.length }] }),
};

// Gunakan pool jika ada, fallback transparan ke memDb jika databaseUrl tidak diisi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = pool ? drizzle(pool) : memDb;
