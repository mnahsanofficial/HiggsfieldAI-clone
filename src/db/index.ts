import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// node-postgres rather than Neon's HTTP driver: the credit ledger needs real
// multi-statement transactions. Fluid compute reuses the pool across invocations.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // pg treats sslmode=require as verify-full today and warns that this changes in v9;
  // state verify-full explicitly so behaviour stays the same after upgrading.
  return new Pool({ connectionString: connectionString.replace("sslmode=require", "sslmode=verify-full"), max: 5 });
}

export const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
