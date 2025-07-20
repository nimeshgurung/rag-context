import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../src/lib/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupDatabase() {
  if (!process.env.POSTGRES_CONNECTION_STRING) {
    throw new Error(
      'POSTGRES_CONNECTION_STRING environment variable is not set.',
    );
  }

  try {
    console.log('Dropping existing tables...');
    await pool.query('DROP TABLE IF EXISTS embeddings CASCADE');
    await pool.query('DROP TABLE IF EXISTS libraries CASCADE');
    await pool.query('DROP TABLE IF EXISTS embedding_jobs CASCADE');
    console.log('Existing tables dropped.');

    console.log('Creating libraries table...');
    const createLibrariesTableSql = fs.readFileSync(
      path.join(__dirname, 'create_libraries_table.sql'),
      'utf8',
    );
    await pool.query(createLibrariesTableSql);
    console.log('Libraries table created successfully.');

    console.log('Creating embeddings table...');
    const createSlopEmbeddingsTableSql = fs.readFileSync(
      path.join(__dirname, 'create_embeddings_table.sql'),
      'utf8',
    );
    await pool.query(createSlopEmbeddingsTableSql);
    console.log('Embeddings table created successfully.');

    console.log('Creating embedding jobs table...');
    const createEmbeddingJobsTableSql = fs.readFileSync(
      path.join(__dirname, 'create_embedding_jobs_table.sql'),
      'utf8',
    );
    await pool.query(createEmbeddingJobsTableSql);
    console.log('Embedding jobs table created successfully.');
  } catch (error) {
    console.error('Error setting up the database:', error);
  } finally {
    await pool.end();
    console.log('Database setup complete.');
  }
}

setupDatabase();
