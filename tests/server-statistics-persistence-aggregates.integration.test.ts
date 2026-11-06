import { sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import {
  createServerStatisticsPersistenceDbMock,
  fixture,
} from "./helpers/server-statistics-persistence-harness";

vi.mock("../packages/db/src/client", async (importOriginal) =>
  createServerStatisticsPersistenceDbMock(importOriginal),
);

import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";

it("keeps adjacent periods disjoint, computes full aggregates and excludes other sources and future observations", async () => {
  await fixture(async (tx, end) => {
    await tx.execute(sql`INSERT INTO server_observations (id, server_id, source, current_players, max_players, observed_at) VALUES
      ('zero', 'public', 'mta_master', 0, 64, ${end.toISOString()}::timestamptz - interval '1 hour'),
      ('unknown', 'public', 'mta_master', NULL, 64, ${end.toISOString()}::timestamptz - interval '2 hours'),
      ('boundary', 'public', 'mta_master', 100, 128, ${end.toISOString()}::timestamptz - interval '24 hours'),
      ('previous', 'public', 'mta_master', 200, 256, ${end.toISOString()}::timestamptz - interval '25 hours'),
      ('too-old', 'public', 'mta_master', 999, 1000, ${end.toISOString()}::timestamptz - interval '49 hours'),
      ('end', 'public', 'mta_master', 999, 1000, ${end.toISOString()}::timestamptz),
      ('source', 'public', 'mta_query', 999, 1000, ${end.toISOString()}::timestamptz - interval '1 hour'),
      ('other', 'team', 'mta_master', 999, 1000, ${end.toISOString()}::timestamptz - interval '1 hour')`);
    const report = await new ServerObservationRepository().readStatistics(
      { id: "public" },
      { kind: "public" },
      24,
      { end },
    );
    expect(report?.summary).toMatchObject({
      observationCount: 3,
      knownPlayerCount: 2,
      averagePlayers: 50,
      peakPlayers: 100,
    });
    expect(report?.previousSummary).toMatchObject({ observationCount: 1, averagePlayers: 200 });
    expect(report?.observations.map((row) => row.id)).toEqual(["zero", "unknown", "boundary"]);
    expect(report?.buckets.reduce((sum, row) => sum + row.observationCount, 0)).toBe(3);
  });
}, 30_000);

it("pages every microsecond observation once and rejects anchors outside this server's period", async () => {
  await fixture(async (tx, end) => {
    await tx.execute(sql`INSERT INTO server_observations (id, server_id, source, current_players, observed_at)
      SELECT 'obs_' || lpad(n::text, 3, '0'), 'public', 'mta_master', n,
        date_trunc('milliseconds', ${end.toISOString()}::timestamptz - interval '1 hour') + n * interval '1 microsecond' FROM generate_series(1,57) n`);
    await tx.execute(sql`INSERT INTO server_observations (id, server_id, source, observed_at)
      VALUES ('foreign', 'team', 'mta_master', ${end.toISOString()}::timestamptz - interval '1 hour')`);
    const repository = new ServerObservationRepository();
    const ids: string[] = [];
    let before: string | undefined;
    for (let page = 0; page < 3; page++) {
      const result = await repository.readStatistics({ id: "public" }, { kind: "public" }, 24, {
        end,
        before,
      });
      if (!result) throw new Error("Missing statistics");
      ids.push(...result.observations.map((row) => row.id));
      before = result.nextCursor ?? undefined;
      expect(result.summary.observationCount).toBe(57);
    }
    expect(ids).toHaveLength(57);
    expect(new Set(ids).size).toBe(57);
    expect(ids[0]).toBe("obs_057");
    expect(ids.at(-1)).toBe("obs_001");
    expect(before).toBeUndefined();
    await expect(
      repository.readStatistics({ id: "public" }, { kind: "public" }, 24, {
        end,
        before: "foreign",
      }),
    ).rejects.toMatchObject({ code: "SERVER_OBSERVATION_PAGE_EXPIRED" });
  });
}, 30_000);
