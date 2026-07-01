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
