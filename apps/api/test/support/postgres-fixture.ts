import { fileURLToPath } from 'node:url';
import { getDrizzleToken } from '@nestjs/drizzle';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import {
    drizzle,
    type NodePgDatabase,
} from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { DatabaseModule } from '../../src/infrastructure/database/database.module.js';

export { Pool };

const migrationConfig = {
    migrationsFolder: fileURLToPath(
        new URL('../../drizzle/', import.meta.url),
    ),
    migrationsSchema: 'nexus_migrations',
    migrationsTable: '__drizzle_migrations',
};

export async function createPostgresFixture() {
    const migrationHashes = readMigrationFiles(migrationConfig).map(
        (migration) => migration.hash,
    );

    const container = await new PostgreSqlContainer(
        'postgres:17.12-bookworm',
    )
        .withDatabase('nexus_test')
        .withUsername('nexus_test')
        .withPassword('nexus_test')
        .start();

    const connectionString = container.getConnectionUri();

    const pool = new Pool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: 5_000,
        statement_timeout: 5_000,
    });

    const db = drizzle({ client: pool });

    return {
        db,
        connectionString,
        migrationHashes,
        migrate: () => migrate(db, migrationConfig),
        close: async () => {
            try {
                await pool.end();
            } finally {
                await container.stop();
            }
        },
    };
}

export async function createDatabaseContext() {
    const context = await Test.createTestingModule({
        imports: [DatabaseModule],
    }).compile();

    try {
        await context.init();

        const db = context.get<NodePgDatabase & { $client: Pool }>(
            getDrizzleToken(),
        );

        return { context, db };
    } catch (error) {
        await context.close();
        throw error;
    }
}