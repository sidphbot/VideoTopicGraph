/**
 * Database Test Helpers
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '../../../services/api/src/db/schema';

let pool: Pool;
let db: ReturnType<typeof drizzle>;

export async function setupTestDb(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/video_graph_test';
  
  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
  });

  db = drizzle(pool, { schema });

  // Run migrations
  await migrate(db, {
    migrationsFolder: './services/api/drizzle',
  });
}

export async function teardownTestDb(): Promise<void> {
  await pool?.end();
}

export async function resetTestDb(): Promise<void> {
  // Truncate all tables
  await pool.query(`
    TRUNCATE TABLE 
      edges, 
      topic_nodes, 
      pipeline_jobs, 
      videos 
    RESTART IDENTITY CASCADE
  `);
}

export function getTestDb() {
  return db;
}
