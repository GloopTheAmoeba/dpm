import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './client.js';
import { Logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const res = await client.query('SELECT version FROM schema_migrations ORDER BY version ASC');
    const appliedVersions = new Set<number>(res.rows.map((row: { version: number }) => row.version));

    // Check dist/database/migrations, src/database/migrations, or process.cwd()/src/database/migrations
    const candidates = [
      path.join(__dirname, 'migrations'),
      path.join(process.cwd(), 'dist', 'database', 'migrations'),
      path.join(process.cwd(), 'src', 'database', 'migrations'),
    ];

    let migrationsDir: string | null = null;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        migrationsDir = candidate;
        break;
      }
    }

    if (!migrationsDir) {
      Logger.warn(`Migrations directory not found in candidates: ${candidates.join(', ')}`);
      await client.query('COMMIT');
      return;
    }

    Logger.info(`Using migrations directory: ${migrationsDir}`);
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (!file.endsWith('.sql')) continue;

      const match = file.match(/^(\d+)_(.+)\.sql$/);
      if (!match) continue;

      const version = parseInt(match[1], 10);
      const name = match[2];

      if (!appliedVersions.has(version)) {
        Logger.info(`Applying migration ${file}...`);
        const filePath = path.join(migrationsDir, file);
        const sql = fs.readFileSync(filePath, 'utf8');

        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [version, name]
        );
        Logger.info(`Migration ${file} applied successfully.`);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    Logger.error('Failed to apply database migrations:', (error as Error).message);
    throw error;
  } finally {
    client.release();
  }
}
