import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './db/schema';
import 'dotenv/config';

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
});

// Drizzle database instance with schema
export const db = drizzle(pool, { schema });

// Export the raw pool for backward compatibility during migration
export default pool;
