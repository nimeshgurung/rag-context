import 'dotenv/config';
import { Pool } from 'pg';

async function clearDatabase() {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error(
      'Database environment variables are not set. Please check DB_HOST, DB_USER, DB_NAME, and DB_PASSWORD.',
    );
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  });

  const client = await pool.connect();

  try {
    console.log('Connected to the database. Clearing existing data...');

    // Drop tables in the correct order (respecting foreign key constraints)
    console.log('Dropping tables...');
    await client.query('DROP TABLE IF EXISTS embeddings CASCADE');
    await client.query('DROP TABLE IF EXISTS embedding_jobs CASCADE');
    await client.query('DROP TABLE IF EXISTS libraries CASCADE');

    // Drop drizzle migration tracking table for complete reset
    console.log('Dropping __drizzle_migrations table...');
    await client.query(
      `DROP TABLE IF EXISTS "drizzle"."__drizzle_migrations" CASCADE`,
    );

    // Verify all tables are gone
    const remainingTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    if (remainingTables.rows.length > 0) {
      console.log(
        '⚠️  Remaining tables:',
        remainingTables.rows.map((r) => r.table_name),
      );
    } else {
      console.log(
        '✅ All tables dropped successfully - database is completely clean.',
      );
    }

    // Drop functions
    console.log('Dropping functions...');
    await client.query(
      'DROP FUNCTION IF EXISTS search_libraries_hybrid CASCADE',
    );
    await client.query(
      'DROP FUNCTION IF EXISTS search_library_documentation CASCADE',
    );
    await client.query('DROP FUNCTION IF EXISTS get_search_analytics CASCADE');
    console.log('✅ Stored procedures dropped successfully.');

    console.log(
      '✅ Database cleared successfully. Run "npm run db:setup" to recreate with new schema.',
    );
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('Database connection closed.');
  }
}

clearDatabase();
