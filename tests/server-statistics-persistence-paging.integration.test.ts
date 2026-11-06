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
