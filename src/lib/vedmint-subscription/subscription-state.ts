import { query, getPool } from "@/lib/mysql";

export interface SubscriptionStateRow {
  account_id: string;
  user_id: string;
  status: string | null;
  plan_name: string | null;
  billing_cycle: string | null;
  period_start: string | null;
  expires_at: string | null;
  expired_applied_at: string | null;
}

function toMysqlDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

/** Persist the latest known plan end date for cron-based auto-expiry. */
export async function upsertSubscriptionState(input: {
  accountId: string;
  userId: string;
  status: string | null;
  planName: string | null;
  expiresAt: string | null;
  billingCycle?: string | null;
  periodStart?: string | null;
}): Promise<void> {
  await ensureSubscriptionStateTable();
  await query(
    `INSERT INTO subscription_state
       (account_id, user_id, status, plan_name, billing_cycle, period_start, expires_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       status = VALUES(status),
       plan_name = VALUES(plan_name),
       billing_cycle = COALESCE(VALUES(billing_cycle), billing_cycle),
       period_start = COALESCE(VALUES(period_start), period_start),
       expires_at = VALUES(expires_at),
       updated_at = UTC_TIMESTAMP()`,
    [
      input.accountId,
      input.userId,
      input.status,
      input.planName,
      input.billingCycle || null,
      toMysqlDateTime(input.periodStart),
      toMysqlDateTime(input.expiresAt),
    ],
  );
}

/** Remember the cycle the user actually purchased (monthly/yearly). */
export async function rememberPurchasedBillingCycle(input: {
  accountId: string;
  userId: string;
  billingCycle: "monthly" | "yearly";
  planName?: string | null;
  periodStart?: string | null;
}): Promise<void> {
  await ensureSubscriptionStateTable();
  const start = toMysqlDateTime(input.periodStart) || toMysqlDateTime(new Date().toISOString());
  await query(
    `INSERT INTO subscription_state
       (account_id, user_id, status, plan_name, billing_cycle, period_start, updated_at)
     VALUES (?, ?, 'pending_payment', ?, ?, ?, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       user_id = VALUES(user_id),
       plan_name = COALESCE(VALUES(plan_name), plan_name),
       billing_cycle = VALUES(billing_cycle),
       period_start = COALESCE(VALUES(period_start), period_start),
       updated_at = UTC_TIMESTAMP()`,
    [
      input.accountId,
      input.userId,
      input.planName || null,
      input.billingCycle,
      start,
    ],
  );
}

export async function getSubscriptionState(
  accountId: string,
): Promise<SubscriptionStateRow | null> {
  await ensureSubscriptionStateTable();
  const rows = await query<SubscriptionStateRow>(
    `SELECT account_id, user_id, status, plan_name, billing_cycle, period_start,
            expires_at, expired_applied_at
     FROM subscription_state
     WHERE account_id = ?
     LIMIT 1`,
    [accountId],
  );
  return rows[0] || null;
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
    `SELECT account_id, user_id, status, plan_name, billing_cycle, period_start,
            expires_at, expired_applied_at
     FROM subscription_state
     WHERE expires_at IS NOT NULL
       AND expires_at <= UTC_TIMESTAMP()
       AND (
         expired_applied_at IS NULL
         OR expired_applied_at < expires_at
       )`,
  );
}

async function addColumnIfMissing(
  column: string,
  definition: string,
): Promise<void> {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'subscription_state'
       AND COLUMN_NAME = ?`,
    [column],
  );
  const count = Number((rows as Array<{ c: number }>)[0]?.c ?? 0);
  if (count === 0) {
    await pool.execute(
      `ALTER TABLE subscription_state ADD COLUMN ${column} ${definition}`,
    );
  }
}

export async function ensureSubscriptionStateTable(): Promise<void> {
  const pool = getPool();
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS subscription_state (
      account_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      status VARCHAR(50) NULL,
      plan_name VARCHAR(255) NULL,
      billing_cycle VARCHAR(20) NULL,
      period_start TIMESTAMP NULL,
      expires_at TIMESTAMP NULL,
      expired_applied_at TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id),
      KEY idx_subscription_state_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Older installs created the table without cycle columns.
  await addColumnIfMissing("billing_cycle", "VARCHAR(20) NULL");
  await addColumnIfMissing("period_start", "TIMESTAMP NULL");
}
