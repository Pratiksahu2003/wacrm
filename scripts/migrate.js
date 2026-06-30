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

async function migrate() {
  loadEnv();

  const connectionUri = process.env.DATABASE_URL;
  let pool;

  if (connectionUri) {
    console.log('[Migration] Connecting using DATABASE_URL...');
    pool = mysql.createPool({
      uri: connectionUri,
      waitForConnections: true,
      connectionLimit: 5
    });
  } else {
    console.log('[Migration] Connecting using DB_HOST/DB_USER...');
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'wacrm',
      port: Number(process.env.DB_PORT) || 3306,
      waitForConnections: true,
      connectionLimit: 5
    });
  }

  try {
    const schemaPath = path.join(__dirname, '..', 'supabase', 'mysql_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error('[Migration] Error: mysql_schema.sql file not found at:', schemaPath);
      process.exit(1);
    }
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Split statements carefully by semicolon at end of line
    const statements = sqlContent
      .split(/;\s*\r?\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`[Migration] Found ${statements.length} SQL statements to execute.`);

    const connection = await pool.getConnection();
    try {
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

migrate();
