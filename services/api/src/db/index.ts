/**
 * Database Connection and Schema
 * 
 * Uses Drizzle ORM with PostgreSQL and pgvector extension.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

// Create connection pool
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.database,
  user: config.database.user,
  password: config.database.password,
  max: config.database.poolSize,
});

// Initialize pgvector extension
pool.on('connect', async (client) => {
  await client.query('CREATE EXTENSION IF NOT EXISTS vector');
});

// Create Drizzle instance
export const db = drizzle(pool, { schema });

// Export schema
export { schema };

// Export types
export type Database = typeof db;
