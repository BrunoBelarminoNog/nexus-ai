import { Logger, Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from './schema.js';

@Module({
  imports: [
    DrizzleModule.forRootAsync({
      useFactory: async () => {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
          throw new Error('DATABASE_URL must be defined.');
        }

        const logger = new Logger('DatabaseModule');

        const pool = new Pool({
          connectionString,
          max: 5,
          connectionTimeoutMillis: 5_000,
          statement_timeout: 5_000,
          application_name: 'nexus-api',
        });

        const db = drizzle({ client: pool, schema });

        try {
          await db.execute(sql`SELECT 1`);
        } catch {
          await pool.end();
          throw new Error('Unable to establish PostgreSQL connection.');
        }

        logger.log('PostgreSQL connection established.');

        return {
          db,
          autoCloseConnection: true,
        };
      },
    }),
  ],
})
export class DatabaseModule {}