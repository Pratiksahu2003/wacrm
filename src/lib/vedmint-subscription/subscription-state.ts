import { query, getPool } from "@/lib/mysql";

export interface SubscriptionStateRow {
  account_id: string;
  user_id: string;
  status: string | null;
  plan_name: string | null;
  expires_at: string | null;
  expired_applied_at: string | null;
}

/** Persist the latest known plan end date for cron-based auto-expiry. */
export async function upsertSubscriptionState(input: {
  accountId: string;
  userId: string;
  status: string | null;
  planName: string | null;
  expiresAt: string | null;
}): Promise<void> {
  await ensureSubscriptionStateTable();
  await query(
    `INSERT INTO subscription_state
       (account_id, user_id, status, plan_name, expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       status = VALUES(status),
       plan_name = VALUES(plan_name),
       expires_at = VALUES(expires_at),
       updated_at = UTC_TIMESTAMP()`,
    [
      input.accountId,
      input.userId,
      input.status,
      input.planName,
      input.expiresAt
        ? new Date(input.expiresAt).toISOString().slice(0, 19).replace("T", " ")
        : null,
    ],
  );
}

export async function markExpiredApplied(accountId: string): Promise<void> {
  await query(
    `UPDATE subscription_state
     SET expired_applied_at = UTC_TIMESTAMP(),
         status = 'expired',
         updated_at = UTC_TIMESTAMP()
     WHERE account_id = ?`,
    [accountId],
  );
}

/** Accounts whose cached period end is past and not yet locally applied. */
export async function listDueExpirations(): Promise<SubscriptionStateRow[]> {
  return query<SubscriptionStateRow>(
    `SELECT account_id, user_id, status, plan_name, expires_at, expired_applied_at
     FROM subscription_state
     WHERE expires_at IS NOT NULL
       AND expires_at <= UTC_TIMESTAMP()
       AND (
         expired_applied_at IS NULL
         OR expired_applied_at < expires_at
       )`,
  );
}

export async function ensureSubscriptionStateTable(): Promise<void> {
  const pool = getPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS subscription_state (
      account_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      status VARCHAR(50) NULL,
      plan_name VARCHAR(255) NULL,
      expires_at TIMESTAMP NULL,
      expired_applied_at TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id),
      KEY idx_subscription_state_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
