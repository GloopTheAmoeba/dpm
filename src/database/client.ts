import pg from 'pg';
import { Logger } from '../utils/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(connectionString?: string): pg.Pool {
  if (!pool) {
    const connStr = connectionString || process.env.DATABASE_URL;
    if (!connStr) {
      throw new Error('DATABASE_URL is not set');
    }
    pool = new Pool({
      connectionString: connStr,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      Logger.error('Unexpected error on idle PostgreSQL client', err.message);
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function testDatabaseConnection(connectionString?: string): Promise<boolean> {
  try {
    const p = getPool(connectionString);
    const client = await p.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    Logger.error('Database connection test failed:', (err as Error).message);
    return false;
  }
}
