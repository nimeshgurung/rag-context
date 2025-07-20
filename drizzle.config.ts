import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rag_context',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: false, // Disable SSL for local development
  },
  verbose: true,
  strict: true,
  migrations: {
    prefix: 'timestamp',
  },
});
