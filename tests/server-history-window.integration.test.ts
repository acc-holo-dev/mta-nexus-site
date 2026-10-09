import { sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";
const active = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../packages/db/src/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../packages/db/src/client")>();
  return {
    ...original,
    db: new Proxy(original.db, {
      get(target, key) {
        const database = (active.db ?? target) as typeof target;
        const value = Reflect.get(database, key);
        return typeof value === "function" ? value.bind(database) : value;
      },
    }),
  };
});
import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";
it("aggregates a full thirty-day history beyond the sample cap on PostgreSQL", async () => {
  const { db } = await vi.importActual<typeof import("../packages/db/src/client")>(
    "../packages/db/src/client",
  );
  // This fixture owns temp DDL, so its outer transaction is read-write. The nested
  // repository savepoint inherits repeatable-read; top-level read-only config is unit-checked.
  await db.transaction(
    async (tx) => {
      active.db = tx;
      try {
        await tx.execute(
          sql`CREATE TEMP TABLE server_observations (LIKE public.server_observations INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`,
        );
        const now = new Date();
        await tx.execute(sql`INSERT INTO server_observations (id, server_id, source, current_players, max_players, observed_at)
        SELECT 'recent-' || lpad(n::text, 4, '0'), 'target', 'mta_master', CASE WHEN n = 10 THEN NULL ELSE n % 50 END,
          250, ${now}::timestamptz - n * interval '1 minute' FROM generate_series(1, 600) n`);
        await tx.execute(sql`INSERT INTO server_observations (id, server_id, source, current_players, max_players, observed_at) VALUES
        ('old-peak', 'target', 'mta_master', 200, 250, ${now}::timestamptz - interval '20 days'),
        ('latest-unknown', 'target', 'mta_master', NULL, 250, ${now}::timestamptz - interval '30 seconds'),
        ('too-old', 'target', 'mta_master', 999, 1000, ${now}::timestamptz - interval '40 days'),
        ('future', 'target', 'mta_master', 999, 1000, ${now}::timestamptz + interval '1 day'),
        ('other-source', 'target', 'mta_query', 999, 1000, ${now}::timestamptz - interval '1 minute'),
        ('other-server', 'other', 'mta_master', 999, 1000, ${now}::timestamptz - interval '1 minute')`);
        const repository = new ServerObservationRepository();
        const result = await repository.readWindow("target", 720);
        let sum = 200;
        for (let n = 1; n <= 600; n++) if (n !== 10) sum += n % 50;
        expect(result.summary).toMatchObject({
          observationCount: 602,
          knownPlayerCount: 600,
          peakPlayers: 200,
          averagePlayers: Math.round((sum / 600) * 10) / 10,
        });
        expect(result.observations).toHaveLength(500);
        expect(result.observations.some((row) => row.id === "old-peak")).toBe(false);
        expect(result.observations.at(-1)?.id).toBe("latest-unknown");
        expect(result.observations.at(-1)?.currentPlayers).toBeNull();
        expect(result.buckets.reduce((count, bucket) => count + bucket.observationCount, 0)).toBe(
          602,
        );
        expect(result.buckets.some((bucket) => bucket.peakPlayers === 200)).toBe(true);
        expect(result.buckets.length).toBeLessThanOrEqual(32);
        expect((await repository.readWindow("target", 24)).summary.observationCount).toBe(601);
        const empty = await repository.readWindow("missing", 720);
        expect(empty.summary).toMatchObject({
          observationCount: 0,
          peakPlayers: null,
          observedFrom: null,
          observedTo: null,
        });
        expect(empty.observations).toEqual([]);
        expect(empty.buckets).toEqual([]);
      } finally {
        active.db = null;
      }
    },
    { isolationLevel: "repeatable read" },
  );
}, 30_000);
