type Queryable = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  release?: () => void;
};

let pool: { connect: () => Promise<Queryable & { release: () => void }>; end: () => Promise<void> } | null = null;
let poolUrl = "";

/** One small pool for the optional direct-Postgres adapter. Not used when the Supabase adapter is selected. */
export async function withDirectPg<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const url = process.env.REVIEW_DATABASE_URL?.trim();
  if (!url) throw new Error("Direct Postgres is not configured.");
  if (!pool || poolUrl !== url) {
    if (pool) await pool.end().catch(() => undefined);
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: url, max: 4 });
    poolUrl = url;
  }
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function endDirectPg() {
  if (!pool) return;
  const current = pool;
  pool = null;
  poolUrl = "";
  await current.end().catch(() => undefined);
}
