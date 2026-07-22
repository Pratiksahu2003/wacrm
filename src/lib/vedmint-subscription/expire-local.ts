import type { ResultSetHeader } from "mysql2";

import { getPool } from "@/lib/mysql";

/**
 * When a plan expires, pause premium automation locally so cron/engine
 * stops acting on behalf of an expired account until they renew.
 */
export async function applyLocalPlanExpiry(accountId: string): Promise<{
  automationsPaused: number;
  flowsPaused: number;
}> {
  const pool = getPool();
  const [autoResult] = await pool.execute<ResultSetHeader>(
    `UPDATE automations
     SET is_active = 0
     WHERE account_id = ? AND is_active = 1`,
    [accountId],
  );
  const [flowResult] = await pool.execute<ResultSetHeader>(
    `UPDATE flows
     SET status = 'draft'
     WHERE account_id = ? AND status = 'active'`,
    [accountId],
  );

  return {
    automationsPaused: autoResult.affectedRows ?? 0,
    flowsPaused: flowResult.affectedRows ?? 0,
  };
}
