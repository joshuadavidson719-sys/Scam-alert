import { AiServiceError } from "./groq";
import { MONTHLY_CREDITS } from "./premiumAccess";

// Free AI and photo uploads must not depend on the optional paid-image ledger.
async function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new AiServiceError(503, "Premium billing is not available yet. No credits were used.");
  }
  return (await import("@workspace/db")).pool;
}

export type GenerationRecord = {
  request_id: string; user_id: string; period_key: string; fingerprint: string;
  reserved: number; charged: number; status: string; created_at: Date;
};

export async function remainingCredits(period: string) {
  const result = await (await getPool()).query("SELECT remaining FROM ai_credit_periods WHERE period_key = $1", [period]);
  return result.rows[0]?.remaining ?? MONTHLY_CREDITS;
}

export async function findGeneration(id: string, userId: string): Promise<GenerationRecord | null> {
  const result = await (await getPool()).query("SELECT * FROM ai_generation_requests WHERE request_id = $1 AND user_id = $2", [id, userId]);
  const row = result.rows[0] as GenerationRecord | undefined;
  if (row?.status === "processing" && new Date(row.created_at).getTime() < Date.now() - 30 * 60_000) {
    await settleCredits(id, 0);
    return { ...row, status: "failed", charged: 0 };
  }
  return row ?? null;
}

export async function reclaimStaleCredits(userId: string) {
  const result = await (await getPool()).query<GenerationRecord>(
    "SELECT * FROM ai_generation_requests WHERE user_id = $1 AND status = 'processing' AND created_at < NOW() - INTERVAL '30 minutes'", [userId]);
  for (const row of result.rows) await settleCredits(row.request_id, 0);
}

export async function reserveCredits(id: string, userId: string, period: string, cost: number, fingerprint: string) {
  const client = await (await getPool()).connect();
  try {
    await client.query("BEGIN");
    // Serialize reservations across instances; the lock is released before model calls.
    await client.query("SELECT pg_advisory_xact_lock(477291)");
    const stale = await client.query<GenerationRecord>(`UPDATE ai_generation_requests SET status = 'failed'
      WHERE status = 'processing' AND created_at < NOW() - INTERVAL '30 minutes' RETURNING *`);
    for (const old of stale.rows) {
      await client.query("UPDATE ai_credit_periods SET remaining = LEAST($1, remaining + $2) WHERE period_key = $3",
        [MONTHLY_CREDITS, old.reserved, old.period_key]);
    }
    const existing = await client.query<GenerationRecord>("SELECT * FROM ai_generation_requests WHERE request_id = $1", [id]);
    if (existing.rows[0]) {
      const row = existing.rows[0];
      if (row.user_id !== userId || row.fingerprint !== fingerprint) throw new AiServiceError(409, "This request ID has already been used for a different generation.");
      await client.query("COMMIT");
      return row;
    }
    const active = await client.query("SELECT user_id FROM ai_generation_requests WHERE status = 'processing'");
    if (active.rows.some(row => row.user_id === userId) || active.rowCount! >= 3) {
      throw new AiServiceError(429, "Another generation is running. Wait for it to finish before trying again.");
    }
    await client.query("INSERT INTO ai_credit_periods (period_key, remaining) VALUES ($1, $2) ON CONFLICT DO NOTHING", [period, MONTHLY_CREDITS]);
    const debit = await client.query("UPDATE ai_credit_periods SET remaining = remaining - $1 WHERE period_key = $2 AND remaining >= $1 RETURNING remaining", [cost, period]);
    if (!debit.rowCount) throw new AiServiceError(402, "Not enough image credits. Your allowance resets at your next monthly renewal.");
    await client.query(`INSERT INTO ai_generation_requests (request_id, user_id, period_key, fingerprint, reserved, status)
      VALUES ($1, $2, $3, $4, $5, 'processing')`, [id, userId, period, fingerprint, cost]);
    await client.query("COMMIT");
    return null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function settleCredits(id: string, charged: number) {
  const client = await (await getPool()).connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<GenerationRecord>("SELECT * FROM ai_generation_requests WHERE request_id = $1 FOR UPDATE", [id]);
    const row = result.rows[0];
    if (row?.status === "processing") {
      if (charged < 0 || charged > row.reserved) throw new Error("Invalid credit settlement");
      await client.query("UPDATE ai_credit_periods SET remaining = remaining + $1 WHERE period_key = $2", [row.reserved - charged, row.period_key]);
      await client.query("UPDATE ai_generation_requests SET charged = $1, status = $2 WHERE request_id = $3",
        [charged, charged ? "completed" : "failed", id]);
    }
    await client.query("COMMIT");
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
