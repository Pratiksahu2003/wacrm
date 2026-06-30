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
        await connection.query(statement);
      }
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
