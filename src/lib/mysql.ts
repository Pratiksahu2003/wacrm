import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool: mysql.Pool | null = null;
let initialized = false;

export function getPool(): mysql.Pool {
  if (pool) return pool;

  const connectionUri = process.env.DATABASE_URL;

  if (connectionUri) {
    pool = mysql.createPool({
      uri: connectionUri,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  } else {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'vedmint_crm',
      port: Number(process.env.DB_PORT) || 3306,
      waitForConnections: true,
      connectionLimit: 20,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }

  // Automatically initialize database schema in background
  if (!initialized) {
    initialized = true;
    initializeDatabase(pool).catch((err) => {
      console.error('[MySQL] async schema init failed:', err);
    });
  }

  return pool;
}

async function ensureEmailVerifiedColumn(connection: mysql.PoolConnection) {
  let columnAdded = false;
  try {
    await connection.query(
      'ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0',
    );
    columnAdded = true;
  } catch (err: any) {
    const alreadyExists =
      err.code === 'ER_DUP_FIELDNAME' ||
      err.errno === 1060;
    if (!alreadyExists) {
      console.warn('[MySQL] email_verified migration:', err.message);
    }
  }

  if (columnAdded) {
    await connection.query('UPDATE users SET email_verified = 1');
    console.log('[MySQL] Grandfathered existing users as email-verified');
  }
}

async function initializeDatabase(p: mysql.Pool) {
  try {
    const schemaPath = path.join(process.cwd(), 'supabase', 'mysql_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.warn('[MySQL] mysql_schema.sql file not found at:', schemaPath);
      return;
    }
    const sqlContent = fs.readFileSync(schemaPath, 'utf8');
    
    // Split statements carefully by semicolon at end of line
    const statements = sqlContent
      .split(/;\s*\r?\n/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    const connection = await p.getConnection();
    try {
      for (const statement of statements) {
        if (!statement) continue;
        try {
          await connection.query(statement);
        } catch (err: any) {
          const isDuplicateError = 
            err.code === 'ER_DUP_KEYNAME' || 
            err.code === 'ER_TABLE_EXISTS_ERROR' || 
            err.code === 'ER_DUP_FIELDNAME' ||
            err.errno === 1061 || 
            err.errno === 1050 || 
            err.errno === 1060;
          
          if (!isDuplicateError) {
            console.warn(`[MySQL] warning executing statement: ${err.message}`);
          }
        }
      }

      await ensureEmailVerifiedColumn(connection);

      console.log('[MySQL] Database schema initialized/verified successfully');
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('[MySQL] Database schema initialization failed:', error);
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows as T[];
}

export async function transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const p = getPool();
  const connection = await p.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
