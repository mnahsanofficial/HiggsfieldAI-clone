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
  const pool = new Pool({
    connectionString: connectionString.replace("sslmode=require", "sslmode=verify-full"),
    max: 5,
    // Drop idle connections before the database side does, and don't hang on a dead network.
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // An idle client whose connection drops (Neon restarts it, the network blips) emits 'error' on
  // the pool. With no listener that's an uncaught exception that takes the whole process down;
  // the pool already discards the broken client, so log it and carry on.
  pool.on("error", (err) => console.error("[db] idle client error, discarded:", err.message));
  return pool;
}

export const pool = globalForDb.pgPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
