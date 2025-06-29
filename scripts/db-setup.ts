import pool from '../src/lib/db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  try {
    // Drop existing tables
    const dropQuery = `
      DROP TABLE IF EXISTS library_docs CASCADE;
      DROP TABLE IF EXISTS libraries CASCADE;
    `;
    await pool.query(dropQuery);
    console.log('Existing tables dropped.');

    // Read and execute the SQL file to create tables
    const createTableSql = fs.readFileSync(
      path.join(__dirname, 'create_table.sql'),
      'utf8',
    );
    await pool.query(createTableSql);
    console.log('Tables created successfully.');
  } catch (error) {
    console.error('Error setting up the database:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase();
