const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)\s*$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
    console.log('[Migration] Loaded environment from .env.local');
  } else {
    console.log('[Migration] No .env.local file found, using system environment variables');
  }
}

async function createPool() {
  const connectionUri = process.env.DATABASE_URL;
  if (connectionUri) {
    console.log('[Migration] Connecting using DATABASE_URL...');
    return mysql.createPool({
      uri: connectionUri,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }

  console.log('[Migration] Connecting using DB_HOST/DB_USER...');
  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vedmint_crm',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 5,
  });
}

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows[0].count > 0;
}

async function addColumnIfMissing(connection, table, column, definition) {
  if (await columnExists(connection, table, column)) {
    console.log(`[Migration] Column ${table}.${column} already exists — skipping`);
    return;
  }
  await connection.query(
    `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
  );
  console.log(`[Migration] Added column ${table}.${column}`);
}

async function tableExists(connection, table) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [table],
  );
  return rows[0].count > 0;
}

async function refreshBroadcastRecipientTriggers(connection) {
  if (!(await tableExists(connection, 'broadcast_recipients'))) return;

  const triggerBody = (idCol) => `
    sent_count = (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = ${idCol}.broadcast_id AND status IN ('sent','delivered','read','replied')),
    delivered_count = (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = ${idCol}.broadcast_id AND status IN ('delivered','read','replied')),
    read_count = (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = ${idCol}.broadcast_id AND status IN ('read','replied')),
    replied_count = (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = ${idCol}.broadcast_id AND status = 'replied'),
    failed_count = (SELECT COUNT(*) FROM broadcast_recipients WHERE broadcast_id = ${idCol}.broadcast_id AND status = 'failed')`;

  await connection.query('DROP TRIGGER IF EXISTS broadcast_recipients_after_insert');
  await connection.query(`
    CREATE TRIGGER broadcast_recipients_after_insert
    AFTER INSERT ON broadcast_recipients
    FOR EACH ROW
      UPDATE broadcasts b
      SET ${triggerBody('NEW')}
      WHERE b.id = NEW.broadcast_id`);

  await connection.query('DROP TRIGGER IF EXISTS broadcast_recipients_after_update');
  await connection.query(`
    CREATE TRIGGER broadcast_recipients_after_update
    AFTER UPDATE ON broadcast_recipients
    FOR EACH ROW
      UPDATE broadcasts b
      SET ${triggerBody('NEW')}
      WHERE b.id = NEW.broadcast_id`);

  await connection.query('DROP TRIGGER IF EXISTS broadcast_recipients_after_delete');
  await connection.query(`
    CREATE TRIGGER broadcast_recipients_after_delete
    AFTER DELETE ON broadcast_recipients
    FOR EACH ROW
      UPDATE broadcasts b
      SET ${triggerBody('OLD')}
      WHERE b.id = OLD.broadcast_id`);

  console.log('[Migration] Refreshed broadcast_recipients aggregate triggers');
}

/** Idempotent patches for databases created before newer columns shipped. */
async function applyIncrementalPatches(connection) {
  console.log('[Migration] Applying incremental patches...');
  await addColumnIfMissing(
    connection,
    'whatsapp_config',
    'registered_at',
    'TIMESTAMP NULL AFTER connected_at',
  );
  await addColumnIfMissing(
    connection,
    'whatsapp_config',
    'subscribed_apps_at',
    'TIMESTAMP NULL AFTER registered_at',
  );
  await addColumnIfMissing(
    connection,
    'whatsapp_config',
    'last_registration_error',
    'TEXT NULL AFTER subscribed_apps_at',
  );

  const messageTemplateColumns = [
    ['header_type', 'VARCHAR(50) NULL'],
    ['header_content', 'TEXT NULL'],
    ['header_handle', 'VARCHAR(512) NULL'],
    ['header_media_url', 'TEXT NULL'],
    ['header_media_id', 'VARCHAR(255) NULL'],
    ['body_text', "TEXT NULL"],
    ['footer_text', 'TEXT NULL'],
    ['buttons', 'JSON NULL'],
    ['sample_values', 'JSON NULL'],
    ['quality_score', 'VARCHAR(20) NULL'],
    ['submission_error', 'TEXT NULL'],
    ['rejection_reason', 'TEXT NULL'],
    ['last_submitted_at', 'TIMESTAMP NULL'],
  ];
  for (const [column, definition] of messageTemplateColumns) {
    await addColumnIfMissing(connection, 'message_templates', column, definition);
  }

  const broadcastRecipientColumns = [
    ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
    ['replied_at', 'TIMESTAMP NULL'],
    ['whatsapp_message_id', 'VARCHAR(255) NULL'],
  ];
  for (const [column, definition] of broadcastRecipientColumns) {
    await addColumnIfMissing(connection, 'broadcast_recipients', column, definition);
  }

  if (
    (await columnExists(connection, 'broadcast_recipients', 'wamid')) &&
    (await columnExists(connection, 'broadcast_recipients', 'whatsapp_message_id'))
  ) {
    await connection.query(
      'UPDATE broadcast_recipients SET whatsapp_message_id = wamid WHERE whatsapp_message_id IS NULL AND wamid IS NOT NULL',
    );
    console.log('[Migration] Copied broadcast_recipients.wamid -> whatsapp_message_id');
  }

  await refreshBroadcastRecipientTriggers(connection);

  // Inbox / WhatsApp webhook columns
  await addColumnIfMissing(
    connection,
    'messages',
    'reply_to_message_id',
    'VARCHAR(36) NULL',
  );
  await addColumnIfMissing(
    connection,
    'messages',
    'interactive_reply_id',
    'VARCHAR(255) NULL',
  );
  await addColumnIfMissing(
    connection,
    'conversations',
    'reply_deadline_at',
    'TIMESTAMP NULL',
  );
  await addColumnIfMissing(
    connection,
    'contacts',
    'last_contacted_at',
    'TIMESTAMP NULL',
  );
  await addColumnIfMissing(
    connection,
    'contacts',
    'last_contacted_via',
    'VARCHAR(50) NULL',
  );
  await addColumnIfMissing(
    connection,
    'contacts',
    'first_inbound_message_at',
    'TIMESTAMP NULL',
  );

  // Compliance / DND / opt-out
  await addColumnIfMissing(
    connection,
    'contacts',
    'opted_out',
    'TINYINT(1) NOT NULL DEFAULT 0',
  );
  await addColumnIfMissing(
    connection,
    'contacts',
    'opted_out_at',
    'TIMESTAMP NULL',
  );
  await addColumnIfMissing(
    connection,
    'contacts',
    'opt_out_source',
    'VARCHAR(50) NULL',
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS account_compliance_settings (
      account_id VARCHAR(36) NOT NULL,
      opt_out_keywords JSON NULL,
      opt_in_keywords JSON NULL,
      opt_out_reply TEXT NULL,
      opt_in_reply TEXT NULL,
      auto_reply_enabled TINYINT(1) NOT NULL DEFAULT 1,
      exclude_from_broadcasts TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id),
      CONSTRAINT fk_compliance_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('[Migration] Ensured account_compliance_settings table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id VARCHAR(36) NOT NULL,
      account_id VARCHAR(36) NOT NULL,
      actor_user_id VARCHAR(36) NULL,
      action VARCHAR(80) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(36) NULL,
      meta JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_audit_account_created (account_id, created_at),
      KEY idx_audit_action (account_id, action),
      CONSTRAINT fk_audit_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('[Migration] Ensured audit_log table');

  // Multi WhatsApp numbers per account + member assignment
  await addColumnIfMissing(
    connection,
    'whatsapp_config',
    'display_name',
    'VARCHAR(255) NULL',
  );
  await addColumnIfMissing(
    connection,
    'whatsapp_config',
    'is_default',
    'TINYINT(1) NOT NULL DEFAULT 0',
  );
  try {
    // Allow multiple numbers per account (was UNIQUE(account_id)).
    // MySQL binds the FK to that unique index — add a non-unique index
    // first, then drop the unique key so the FK can keep using account_id.
    await connection.query(
      'ALTER TABLE whatsapp_config ADD INDEX idx_whatsapp_config_account_id (account_id)',
    );
    console.log('[Migration] Added non-unique index on whatsapp_config.account_id');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Duplicate key name|already exists/i.test(msg)) {
      console.warn('[Migration] Add idx_whatsapp_config_account_id:', msg);
    }
  }
  try {
    await connection.query('ALTER TABLE whatsapp_config DROP INDEX account_id');
    console.log('[Migration] Dropped UNIQUE(account_id) on whatsapp_config');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/needed in a foreign key/i.test(msg)) {
      try {
        await connection.query(
          'ALTER TABLE whatsapp_config DROP FOREIGN KEY whatsapp_config_ibfk_1',
        );
        await connection.query('ALTER TABLE whatsapp_config DROP INDEX account_id');
        await connection.query(`
          ALTER TABLE whatsapp_config
          ADD CONSTRAINT whatsapp_config_ibfk_1
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
        `);
        console.log(
          '[Migration] Dropped UNIQUE(account_id) and restored FK on whatsapp_config',
        );
      } catch (inner) {
        console.warn(
          '[Migration] Drop whatsapp_config.account_id unique (FK path):',
          inner instanceof Error ? inner.message : String(inner),
        );
      }
    } else if (!/check that.+exists|Can't DROP|1091/i.test(msg)) {
      console.warn('[Migration] Drop whatsapp_config.account_id unique:', msg);
    }
  }
  // Mark existing single rows as default when none set.
  await connection.query(`
    UPDATE whatsapp_config wc
    INNER JOIN (
      SELECT account_id, MIN(created_at) AS first_at
      FROM whatsapp_config
      GROUP BY account_id
    ) first_row
      ON first_row.account_id = wc.account_id
     AND first_row.first_at = wc.created_at
    SET wc.is_default = 1
    WHERE wc.account_id NOT IN (
      SELECT account_id FROM (
        SELECT account_id FROM whatsapp_config WHERE is_default = 1
      ) t
    )
  `);
  console.log('[Migration] Ensured default WhatsApp numbers per account');

  await addColumnIfMissing(
    connection,
    'profiles',
    'whatsapp_config_id',
    'VARCHAR(36) NULL',
  );

  // Subscription plan expiry cache (VedMint Billing auto-expire cron)
  await connection.query(`
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
  console.log('[Migration] Ensured subscription_state table');

  // Email marketing (BYO SMTP + lists + campaigns)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS account_smtp_settings (
      account_id VARCHAR(36) NOT NULL,
      host VARCHAR(255) NOT NULL,
      port INT NOT NULL DEFAULT 587,
      secure TINYINT(1) NOT NULL DEFAULT 0,
      username VARCHAR(255) NOT NULL,
      password_encrypted TEXT NOT NULL,
      from_name VARCHAR(255) NULL,
      from_email VARCHAR(255) NOT NULL,
      reply_to VARCHAR(255) NULL,
      verified_at TIMESTAMP NULL,
      last_error TEXT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (account_id),
      CONSTRAINT fk_smtp_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('[Migration] Ensured account_smtp_settings table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS email_lists (
      id VARCHAR(36) NOT NULL,
      account_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      public_slug VARCHAR(80) NOT NULL,
      double_opt_in TINYINT(1) NOT NULL DEFAULT 0,
      subscriber_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_email_lists_account_slug (account_id, public_slug),
      KEY idx_email_lists_account (account_id),
      CONSTRAINT fk_email_lists_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('[Migration] Ensured email_lists table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS email_subscribers (
      id VARCHAR(36) NOT NULL,
      account_id VARCHAR(36) NOT NULL,
      list_id VARCHAR(36) NOT NULL,
      email VARCHAR(320) NOT NULL,
      name VARCHAR(255) NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'subscribed',
      source VARCHAR(20) NOT NULL DEFAULT 'manual',
      unsubscribe_token VARCHAR(64) NOT NULL,
      subscribed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      unsubscribed_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_email_subscribers_list_email (list_id, email),
      UNIQUE KEY uq_email_subscribers_token (unsubscribe_token),
      KEY idx_email_subscribers_list_status (list_id, status),
      KEY idx_email_subscribers_account (account_id),
      CONSTRAINT fk_email_subscribers_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      CONSTRAINT fk_email_subscribers_list
        FOREIGN KEY (list_id) REFERENCES email_lists(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('[Migration] Ensured email_subscribers table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id VARCHAR(36) NOT NULL,
      account_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      html_body MEDIUMTEXT NOT NULL,
      text_body TEXT NULL,
      variables JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_email_templates_account (account_id),
      CONSTRAINT fk_email_templates_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('[Migration] Ensured email_templates table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id VARCHAR(36) NOT NULL,
      account_id VARCHAR(36) NOT NULL,
      list_id VARCHAR(36) NOT NULL,
      template_id VARCHAR(36) NULL,
      name VARCHAR(255) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      html_body MEDIUMTEXT NOT NULL,
      text_body TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      scheduled_at TIMESTAMP NULL,
      started_at TIMESTAMP NULL,
      completed_at TIMESTAMP NULL,
      total_count INT NOT NULL DEFAULT 0,
      sent_count INT NOT NULL DEFAULT 0,
      failed_count INT NOT NULL DEFAULT 0,
      skipped_count INT NOT NULL DEFAULT 0,
      created_by VARCHAR(36) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_email_campaigns_account_status (account_id, status),
      KEY idx_email_campaigns_list (list_id),
      CONSTRAINT fk_email_campaigns_account
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      CONSTRAINT fk_email_campaigns_list
        FOREIGN KEY (list_id) REFERENCES email_lists(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('[Migration] Ensured email_campaigns table');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS email_campaign_recipients (
      id VARCHAR(36) NOT NULL,
      campaign_id VARCHAR(36) NOT NULL,
      subscriber_id VARCHAR(36) NOT NULL,
      email VARCHAR(320) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      error TEXT NULL,
      sent_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_email_recipients_campaign_status (campaign_id, status),
      KEY idx_email_recipients_subscriber (subscriber_id),
      CONSTRAINT fk_email_recipients_campaign
        FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE,
      CONSTRAINT fk_email_recipients_subscriber
        FOREIGN KEY (subscriber_id) REFERENCES email_subscribers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  console.log('[Migration] Ensured email_campaign_recipients table');
}

async function migrate({ patchesOnly = false } = {}) {
  loadEnv();

  const pool = await createPool();

  try {
    const connection = await pool.getConnection();
    try {
      if (!patchesOnly) {
        const schemaPath = path.join(__dirname, '..', 'supabase', 'mysql_schema.sql');
        if (!fs.existsSync(schemaPath)) {
          console.error('[Migration] Error: mysql_schema.sql file not found at:', schemaPath);
          process.exit(1);
        }
        const sqlContent = fs.readFileSync(schemaPath, 'utf8');
        
        // Split statements carefully by stripping SQL comment lines first, then splitting by semicolon at the end of lines
        const lines = sqlContent.split(/\r?\n/);
        const cleanLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        const cleanSql = cleanLines.join('\n');
        const statements = cleanSql
          .split(/;\s*$/m)
          .map(s => s.trim())
          .filter(s => s.length > 0);

        console.log(`[Migration] Found ${statements.length} SQL statements to execute.`);

        let count = 0;
        for (const statement of statements) {
          if (!statement) continue;
          await connection.query(statement);
          count++;
          // Print progress
          if (count % 5 === 0 || count === statements.length) {
            console.log(`[Migration] Executed ${count}/${statements.length} statements...`);
          }
        }
      } else {
        console.log('[Migration] Patches-only mode — skipping base schema.');
      }
      await applyIncrementalPatches(connection);
      console.log('[Migration] Database migrated/updated successfully!');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[Migration] Database migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

const patchesOnly = process.argv.includes('--patches-only');
migrate({ patchesOnly });
