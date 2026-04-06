import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/degenscreener";

// During Next.js build (no DB available), return safe stubs.
const isBuildTime =
  process.env.SKIP_DB === "1" ||
  (typeof process.env.DATABASE_URL === "undefined" &&
    typeof process.env.NODE_ENV === "string");

let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

export function getPool(): pg.Pool {
  if (isBuildTime) {
    throw new Error("Database not available at build time");
  }
  if (!_pool) {
    _pool = new pg.Pool({ connectionString: DATABASE_URL });
  }
  return _pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (isBuildTime) {
    throw new Error("Database not available at build time");
  }
  if (!_db) {
    _db = drizzle(getPool(), { schema });
  }
  return _db;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    if (isBuildTime) return () => {};
    return (getPool() as any)[prop];
  },
});

export const db: NodePgDatabase<typeof schema> = new Proxy(
  {} as NodePgDatabase<typeof schema>,
  {
    get(_target, prop) {
      if (isBuildTime) return () => Promise.resolve([]);
      return (getDb() as any)[prop];
    },
  },
);
/* eslint-enable @typescript-eslint/no-explicit-any */

export type DB = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export async function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => fn(tx));
}
