import 'dotenv/config';
import { PgVector } from '@mastra/pg';
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

  const store = new PgVector({
    connectionString: process.env.POSTGRES_CONNECTION_STRING,
  });

  try {
    console.log('Dropping existing tables...');
    await pool.query('DROP TABLE IF EXISTS slop_embeddings CASCADE');
    await pool.query('DROP TABLE IF EXISTS libraries CASCADE');
    await pool.query('DROP TABLE IF EXISTS embedding_jobs CASCADE');
    console.log('Existing tables dropped.');

    console.log('Creating indexes with PgVector...');
    await store.createIndex({ indexName: 'libraries', dimension: 1536 });
    console.log('Index "libraries" created.');

    await store.createIndex({
      indexName: 'embeddings',
      dimension: 1536,
    });
    console.log('Index "embeddings" created.');

    const createEmbeddingJobsTableSql = fs.readFileSync(
      path.join(__dirname, 'create_embedding_jobs_table.sql'),
      'utf8',
    );
    await pool.query(createEmbeddingJobsTableSql);
    console.log('Embedding jobs table created successfully.');
  } catch (error) {
    console.error('Error setting up the database:', error);
  } finally {
    await store.disconnect();
    await pool.end();
    console.log('Database setup complete.');
  }
}

setupDatabase();
