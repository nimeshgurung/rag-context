import 'dotenv/config';
import { Pool } from 'pg';

async function clearDatabase() {
  const connectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('POSTGRES_CONNECTION_STRING is not set in .env file');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  console.log('Connecting to the database to clear tables...');

  try {
    await client.query('BEGIN');

    // Use DROP TABLE IF EXISTS to completely remove the tables.
    // CASCADE will remove any dependent objects.
    console.log('Dropping tables: libraries, slop_embeddings...');
    await client.query('DROP TABLE IF EXISTS slop_embeddings CASCADE;');
    await client.query('DROP TABLE IF EXISTS libraries CASCADE;');

    await client.query('COMMIT');
    console.log('Database tables dropped successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error clearing database tables:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

clearDatabase().catch((error) => {
  console.error('An error occurred during the database clearing process:', error);
  process.exit(1);
});