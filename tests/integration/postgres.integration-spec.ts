import {
    createDatabaseContext,
    createPostgresFixture,
    Pool,
} from '../../apps/api/test/support/postgres-fixture.js';

describe.sequential('PostgreSQL integration', () => {
    let fixture: Awaited<ReturnType<typeof createPostgresFixture>>;

    beforeAll(async () => {
        fixture = await createPostgresFixture();
    });

    beforeEach(() => {
        vi.stubEnv('DATABASE_URL', fixture.connectionString);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    afterAll(async () => {
        if (fixture) {
            await fixture.close();
        }
    });

    it('applies migrations to an empty database and preserves data on rerun', async () => {
        const schemas = await fixture.db.execute(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name IN ('nexus', 'nexus_migrations')
    `);

        expect(schemas.rows).toEqual([]);
        expect(fixture.migrationHashes.length).toBeGreaterThan(0);

        await fixture.migrate();

        const before = await fixture.db.$client.query<{ hash: string }>(`
      SELECT hash
      FROM nexus_migrations.__drizzle_migrations
      ORDER BY id
    `);

        expect(before.rows.map((row) => row.hash)).toEqual(
            fixture.migrationHashes,
        );

        await fixture.db.execute(`
      CREATE TABLE nexus.integration_probe (
        id integer PRIMARY KEY,
        payload text NOT NULL
      )
    `);

        await fixture.db.$client.query(
            'INSERT INTO nexus.integration_probe VALUES ($1, $2)',
            [1, 'checkpoint-4'],
        );

        await fixture.migrate();

        const after = await fixture.db.$client.query<{ hash: string }>(`
      SELECT hash
      FROM nexus_migrations.__drizzle_migrations
      ORDER BY id
    `);

        const data = await fixture.db.execute(`
      SELECT id, payload FROM nexus.integration_probe
    `);

        expect(after.rows).toEqual(before.rows);
        expect(data.rows).toEqual([
            { id: 1, payload: 'checkpoint-4' },
        ]);
    });

    it('injects a working database and closes its pool on shutdown', async () => {
        const application = await createDatabaseContext();
        const endSpy = vi.spyOn(application.db.$client, 'end');

        try {
            const result = await application.db.execute('SELECT 1 AS ok');
            expect(result.rows).toEqual([{ ok: 1 }]);
        } finally {
            await application.context.close();
        }

        expect(endSpy).toHaveBeenCalledTimes(1);

        await expect(
            application.db.$client.query('SELECT 1'),
        ).rejects.toThrow();
    });

    it('rejects initialization when DATABASE_URL is missing', async () => {
        vi.stubEnv('DATABASE_URL', undefined);

        await expect(createDatabaseContext()).rejects.toThrow(
            'DATABASE_URL must be defined.',
        );
    });

    it('releases the pool when the target database does not exist', async () => {
        const invalidUrl = new URL(fixture.connectionString);
        invalidUrl.pathname = '/nexus_missing_database';

        vi.stubEnv('DATABASE_URL', invalidUrl.toString());

        const endSpy = vi.spyOn(Pool.prototype, 'end');

        await expect(createDatabaseContext()).rejects.toThrow(
            'Unable to establish PostgreSQL connection.',
        );

        expect(endSpy).toHaveBeenCalledTimes(1);
    });
});