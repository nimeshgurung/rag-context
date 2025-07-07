import pool from '../src/lib/db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration(filename: string) {
  console.log(`Running migration: ${filename}`);
  
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', filename), 'utf-8');
    await pool.query(sql);
    console.log(`✅ Migration ${filename} completed successfully`);
  } catch (error) {
    console.error(`❌ Migration ${filename} failed:`, error);
    throw error;
  }
}

async function main() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    console.error('Please provide a migration file name');
    console.error('Usage: npm run migration <filename>');
    process.exit(1);
  }
  
  try {
    await runMigration(migrationFile);
    await pool.end();
    process.exit(0);
  } catch (error) {
    await pool.end();
    process.exit(1);
  }
}

main();