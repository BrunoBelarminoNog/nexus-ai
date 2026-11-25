import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Type } from '@nestjs/common';
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

// Reproduce a checkout at NX-010 using its real SQL and Drizzle journal entry.
async function migrateInitialSchema(db: NodePgDatabase) {
    const folder = await mkdtemp(join(tmpdir(), 'nexus-nx010-'));
    try {
        const source = migrationConfig.migrationsFolder;
        const journalFile = 'meta/_journal.json';
        const journal = JSON.parse(await readFile(join(source, journalFile), 'utf8')) as {
            entries: { tag: string }[];
        };
        const baseline = journal.entries[0];
        await mkdir(join(folder, 'meta'));
        await copyFile(join(source, baseline.tag + '.sql'), join(folder, baseline.tag + '.sql'));
        await writeFile(join(folder, journalFile), JSON.stringify({ ...journal, entries: [baseline] }));
        await migrate(db, { ...migrationConfig, migrationsFolder: folder });
    } finally {
        await rm(folder, { recursive: true, force: true });
    }
}

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
        migrateInitialSchema: () => migrateInitialSchema(db),
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

export async function createDatabaseContext(rootModule: Type = DatabaseModule) {
    const context = await Test.createTestingModule({
        imports: [rootModule],
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
