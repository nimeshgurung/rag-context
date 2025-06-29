import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const MIGRATIONS_DIR = path.dirname(__filename);

async function runMigrations() {
  const connectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('POSTGRES_CONNECTION_STRING is not set in .env file');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log('Connected to the database. Starting migrations...');

  try {
    // 1. Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Ensured migrations table exists.');

    // 2. Get already run migrations
    const { rows: ranMigrations } = await client.query(
      'SELECT name FROM migrations;',
    );
    const ranMigrationNames = new Set(ranMigrations.map((row) => row.name));
    console.log('Already executed migrations:', [...ranMigrationNames]);

    // 3. Get all migration files from the directory
    const allFiles = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = allFiles.filter((file) => file.endsWith('.sql')).sort();

    console.log('Found migration files:', sqlFiles);

    // 4. Filter out already run migrations and execute new ones
    for (const file of sqlFiles) {
      if (ranMigrationNames.has(file)) {
        console.log(`Skipping already executed migration: ${file}`);
        continue;
      }

      console.log(`Executing migration: ${file}`);
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Successfully executed and recorded migration: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(
          `Failed to execute migration ${file}. Rolled back transaction.`,
          err,
        );
        throw err;
      }
    }

    console.log('All new migrations executed successfully.');
  } catch (error) {
    console.error('An error occurred during the migration process:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

runMigrations().catch((error) => {
  console.error('Migration script failed.', error);
  process.exit(1);
});
