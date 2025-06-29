import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

async function clearAndSetupDatabase() {
  const postgresConnectionString = process.env.POSTGRES_CONNECTION_STRING;
  if (!postgresConnectionString) {
    throw new Error(
      'POSTGRES_CONNECTION_STRING is not defined in environment variables.',
    );
  }

  const pool = new Pool({ connectionString: postgresConnectionString });
  const client = await pool.connect();

  try {
    console.log('Connected to the database. Running setup script...');
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const setupSql = fs.readFileSync(
      path.join(__dirname, 'create_table.sql'),
      'utf8',
    );
    await client.query(setupSql);
    console.log('Database setup complete. Tables are created and ready.');
  } catch (error) {
    console.error('Failed to setup database:', error);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

clearAndSetupDatabase();
