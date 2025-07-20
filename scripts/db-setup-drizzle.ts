import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from '../src/lib/db';

async function setupDatabase() {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
    throw new Error(
      'Database environment variables are not set. Please check DB_HOST, DB_USER, DB_NAME, and DB_PASSWORD.'
    );
  }

  try {
    console.log('🗃️  Setting up database with Drizzle migrations...');
    
    // Run all pending migrations
    await migrate(db, { migrationsFolder: './drizzle' });
    
    console.log('✅ Database setup complete! All tables and indexes are ready.');
    console.log('📊 Tables created:');
    console.log('   - libraries (with vector embeddings and full-text search)');
    console.log('   - embeddings (with vector similarity indexes)');
    console.log('   - embedding_jobs (job queue management)');
    
  } catch (error) {
    console.error('❌ Error setting up the database:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase().catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });
}