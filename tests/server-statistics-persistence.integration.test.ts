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

async function fixture(
  run: (tx: typeof import("../packages/db/src/client").db, end: Date) => Promise<void>,
) {
  const { db } = await vi.importActual<typeof import("../packages/db/src/client")>(
    "../packages/db/src/client",
  );
  await db.transaction(
    async (tx) => {
      active.db = tx;
      try {
        // Temporary copies isolate this read fixture from application data. Its outer
        // transaction owns DDL and inherits repeatable-read for repository savepoints.
        for (const name of [
          "users",
          "organizations",
          "organization_members",
          "servers",
          "server_observations",
        ])
          await tx.execute(
            sql`CREATE TEMP TABLE ${sql.identifier(name)} (LIKE ${sql.identifier("public")}.${sql.identifier(name)} INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`,
          );
        await tx.execute(sql`INSERT INTO users (id, email, username, display_name, role) VALUES
        ('owner', 'owner@test.invalid', 'owner', 'Owner', 'user'),
        ('delegate', 'delegate@test.invalid', 'delegate', 'Delegate', 'user'),
        ('admin', 'admin@test.invalid', 'admin', 'Admin', 'admin')`);
        await tx.execute(
          sql`INSERT INTO organizations (id, name, slug, owner_id) VALUES ('org', 'Org', 'org', 'owner')`,
        );
        await tx.execute(sql`INSERT INTO organization_members (id, organization_id, user_id, role, permissions)
        VALUES ('member', 'org', 'delegate', 'member', '["manage_servers"]'::jsonb)`);
        await tx.execute(sql`INSERT INTO servers (id, name, slug, ip_address, owner_id, organization_id, visibility) VALUES
        ('personal', 'Personal', 'personal', '203.0.113.1', 'owner', NULL, 'private'),
        ('team', 'Team', 'team', '203.0.113.2', 'delegate', 'org', 'private'),
        ('public', 'Public', 'public', '203.0.113.3', 'owner', NULL, 'public')`);
        await run(tx as unknown as typeof db, new Date(Date.now() - 1000));
      } finally {
        active.db = null;
      }
    },
    { isolationLevel: "repeatable read" },
  );
}

it("checks persisted public visibility, current organization grants and live administrator roles", async () => {
  await fixture(async (tx) => {
    const repository = new ServerObservationRepository();
    expect(await repository.readStatistics({ id: "personal" }, { kind: "public" }, 24)).toBeNull();
    expect(
      await repository.readStatistics(
        { id: "personal" },
        { kind: "managed", actorId: "delegate" },
        24,
      ),
    ).toBeNull();
    expect(
      await repository.readStatistics(
        { id: "personal" },
        { kind: "managed", actorId: "owner" },
        24,
      ),
    ).not.toBeNull();
    expect(
      await repository.readStatistics({ id: "team" }, { kind: "managed", actorId: "delegate" }, 24),
    ).not.toBeNull();
    await tx.execute(
      sql`UPDATE organization_members SET permissions = '[]'::jsonb WHERE id = 'member'`,
    );
    // A legacy personal-owner column must not bypass the organization boundary.
    expect(
      await repository.readStatistics({ id: "team" }, { kind: "managed", actorId: "delegate" }, 24),
    ).toBeNull();
    expect(
      await repository.readStatistics({ id: "team" }, { kind: "managed", actorId: "owner" }, 24),
    ).not.toBeNull();
    expect(
      await repository.readStatistics(
        { id: "personal" },
        { kind: "managed", actorId: "admin" },
        24,
      ),
    ).not.toBeNull();
    await tx.execute(sql`UPDATE users SET role = 'user' WHERE id = 'admin'`);
    expect(
      await repository.readStatistics(
        { id: "personal" },
        { kind: "managed", actorId: "admin" },
        24,
      ),
    ).toBeNull();
    await tx.execute(sql`UPDATE servers SET visibility = 'unlisted' WHERE id = 'personal'`);
    expect(
      await repository.readStatistics({ slug: "personal" }, { kind: "public" }, 24),
    ).not.toBeNull();
  });
}, 30_000);

it("traverses filtered exact-time pages in both directions and continues after anchor removal", async () => {
  await fixture(async (tx, end) => {
    await tx.execute(sql`INSERT INTO server_observations (id, server_id, source, game_mode, current_players, observed_at)
      SELECT 'browse_' || lpad(n::text,3,'0'),'public','mta_master','Lua%_',0,
        date_trunc('milliseconds',${end.toISOString()}::timestamptz-interval '1 hour')+n*interval '1 microsecond'
      FROM generate_series(1,57) n`);
    await tx.execute(sql`INSERT INTO server_observations (id,server_id,source,game_mode,observed_at) VALUES
      ('wildcard','public','mta_master','LuaZZZ',${end.toISOString()}::timestamptz-interval '1 hour'),
      ('foreign-source','public','mta_query','Lua%_',${end.toISOString()}::timestamptz-interval '1 hour')`);
    const repository = new ServerObservationRepository(),
      filters = {
        end,
        query: "Lua%_",
        players: "zero" as const,
        password: "all" as const,
        responding: "all" as const,
      };
    const first = await repository.pageObservations(
      { id: "public" },
      { kind: "public" },
      24,
      filters,
    );
    if (!first?.nextCursor) throw Error("Expected continuation");
    expect(first.observations).toHaveLength(25);
    expect(first.nextCursor.createdAt).toMatch(/\.\d{6}Z$/u);
    const second = await repository.pageObservations({ id: "public" }, { kind: "public" }, 24, {
      ...filters,
      cursor: { ...first.nextCursor, context: first.context, direction: "older" },
    });
    if (!second?.previousCursor || !second.nextCursor) throw Error("Expected two-way continuation");
    const previous = await repository.pageObservations({ id: "public" }, { kind: "public" }, 24, {
      ...filters,
      cursor: { ...second.previousCursor, context: second.context, direction: "newer" },
    });
    expect(previous?.observations.map((row) => row.id)).toEqual(
      first.observations.map((row) => row.id),
    );
    await tx.execute(sql`DELETE FROM server_observations WHERE id=${first.nextCursor.id}`);
    const continued = await repository.pageObservations({ id: "public" }, { kind: "public" }, 24, {
      ...filters,
      cursor: { ...first.nextCursor, context: first.context, direction: "older" },
    });
    expect(continued?.observations.map((row) => row.id)).toEqual(
      second.observations.map((row) => row.id),
    );
    const third = await repository.pageObservations({ id: "public" }, { kind: "public" }, 24, {
      ...filters,
      cursor: { ...second.nextCursor, context: second.context, direction: "older" },
    });
    const ids = [...first.observations, ...second.observations, ...(third?.observations ?? [])].map(
      (row) => row.id,
    );
    expect(ids).toHaveLength(57);
    expect(new Set(ids).size).toBe(57);
    expect(ids[0]).toBe("browse_057");
    expect(ids.at(-1)).toBe("browse_001");
    expect(third?.nextCursor).toBeNull();
  });
}, 30_000);

it("filters known, zero and unknown telemetry independently and bounds supplementary Unicode text", async () => {
  await fixture(async (tx, end) => {
    await tx.execute(sql`INSERT INTO server_observations (id,server_id,source,game_mode,current_players,passworded,responding,observed_at) VALUES
      ('zero','public','mta_master',${"😀".repeat(500)},0,false,NULL,${end.toISOString()}::timestamptz-interval '1 hour'),
      ('unknown','public','mta_master','mode',NULL,true,false,${end.toISOString()}::timestamptz-interval '2 hours'),
      ('known','public','mta_master','mode',12,NULL,true,${end.toISOString()}::timestamptz-interval '3 hours'),
      ('end','public','mta_master','mode',0,false,NULL,${end.toISOString()}::timestamptz),
      ('before','public','mta_master','mode',0,false,NULL,${end.toISOString()}::timestamptz-interval '25 hours')`);
    const repository = new ServerObservationRepository(),
      filters = {
        end,
        query: "",
        players: "all" as const,
        password: "all" as const,
        responding: "all" as const,
      };
    const zero = await repository.pageObservations({ id: "public" }, { kind: "public" }, 24, {
      ...filters,
      players: "zero",
      password: "no",
      responding: "unknown",
    });
    expect(zero?.observations.map((row) => row.id)).toEqual(["zero"]);
    expect(Array.from(zero?.observations[0].gameMode ?? "")).toHaveLength(240);
    expect(
      (
        await repository.pageObservations({ id: "public" }, { kind: "public" }, 24, {
          ...filters,
          players: "unknown",
          password: "yes",
          responding: "no",
        })
      )?.observations.map((row) => row.id),
    ).toEqual(["unknown"]);
    expect(
      (
        await repository.pageObservations({ id: "public" }, { kind: "public" }, 24, {
          ...filters,
          players: "known",
        })
      )?.observations.map((row) => row.id),
    ).toEqual(["zero", "known"]);
  });
}, 30_000);

it("rechecks current grants and binds observation continuations to account, target and period", async () => {
  await fixture(async (tx, end) => {
    await tx.execute(sql`INSERT INTO server_observations (id,server_id,source,observed_at)
      SELECT 'private_'||lpad(n::text,3,'0'),'team','mta_master',${end.toISOString()}::timestamptz-interval '1 hour' FROM generate_series(1,26) n`);
    const repository = new ServerObservationRepository(),
      filters = {
        end,
        query: "",
        players: "all" as const,
        password: "all" as const,
        responding: "all" as const,
      };
    expect(
      await repository.pageObservations({ id: "team" }, { kind: "public" }, 24, filters),
    ).toBeNull();
    const first = await repository.pageObservations(
      { id: "team" },
      { kind: "managed", actorId: "delegate" },
      24,
      filters,
    );
    if (!first?.nextCursor) throw Error("Expected continuation");
    const cursor = { ...first.nextCursor, context: first.context, direction: "older" as const };
    await expect(
      repository.pageObservations({ id: "team" }, { kind: "managed", actorId: "owner" }, 24, {
        ...filters,
        cursor,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    await expect(
      repository.pageObservations({ id: "team" }, { kind: "managed", actorId: "delegate" }, 168, {
        ...filters,
        cursor,
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    const ownerPage = await repository.pageObservations(
      { id: "team" },
      { kind: "managed", actorId: "owner" },
      24,
      filters,
    );
    if (!ownerPage?.nextCursor) throw Error("Expected owner continuation");
    await expect(
      repository.pageObservations({ id: "public" }, { kind: "managed", actorId: "owner" }, 24, {
        ...filters,
        cursor: { ...ownerPage.nextCursor, context: ownerPage.context, direction: "older" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    await tx.execute(
      sql`UPDATE organization_members SET permissions='[]'::jsonb WHERE id='member'`,
    );
    expect(
      await repository.pageObservations(
        { id: "team" },
        { kind: "managed", actorId: "delegate" },
        24,
        { ...filters, cursor },
      ),
    ).toBeNull();
    expect(
      await repository.pageObservations(
        { id: "team" },
        { kind: "managed", actorId: "admin" },
        24,
        filters,
      ),
    ).not.toBeNull();
    await tx.execute(sql`UPDATE users SET role='user' WHERE id='admin'`);
    expect(
      await repository.pageObservations(
        { id: "team" },
        { kind: "managed", actorId: "admin" },
        24,
        filters,
      ),
    ).toBeNull();
    await tx.execute(sql`UPDATE servers SET visibility='public' WHERE id='team'`);
    expect(
      await repository.pageObservations({ id: "team" }, { kind: "public" }, 24, filters),
    ).not.toBeNull();
    await tx.execute(sql`UPDATE servers SET visibility='private' WHERE id='team'`);
    expect(
      await repository.pageObservations({ id: "team" }, { kind: "public" }, 24, filters),
    ).toBeNull();
  });
}, 30_000);

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
