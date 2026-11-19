import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be defined.');
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5_000,
  statement_timeout: 5_000,
});

pool.on('error', () => {
  console.error('Unexpected idle PostgreSQL connection error.');
  process.exitCode = 1;
});

const db = drizzle({ client: pool });

try {
  const result = await db.execute(sql`
    SELECT
      1 AS ok,
      current_database() AS database,
      current_user AS username
  `);

  assert.equal(result.rows[0]?.ok, 1);

  console.table(result.rows);
  console.log('PostgreSQL connection OK');
} finally {
  await pool.end();
}