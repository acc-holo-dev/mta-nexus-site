import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createServerObservationBrowserQueryDbMock } = await import(
    "./helpers/server-observation-browser-query-harness"
  );
  return createServerObservationBrowserQueryDbMock();
});

import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";
import {
  installServerObservationBrowserQueryHooks,
  serverObservationBrowserQueryContext as context,
  serverObservationBrowserQueryExact as exact,
  serverObservationBrowserQueryFilters as filters,
  serverObservationBrowserQueryRow as row,
  serverObservationBrowserQueryServer as server,
  serverObservationBrowserQueryState as state,
} from "./helpers/server-observation-browser-query-harness";

installServerObservationBrowserQueryHooks();

const repository = new ServerObservationRepository();

it("reuses public visibility authority and selects only a bounded observation page without aggregates", async () => {
  const result = await repository.pageObservations(
    { slug: "server" },
    { kind: "public" },
    24,
    filters,
  );
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(2);
  expect(state.queries[0].params).toEqual(["server", "public", "unlisted", 1]);
  const query = state.queries[1];
  expect(query.params).toContain("mta_master");
  expect(query.params).toContain(filters.end.toISOString());
  expect(query.params.at(-1)).toBe(26);
  expect(query.sql).not.toMatch(/offset|count\(|avg\(|created_at|source_sequence|"name"/iu);
  expect(query.sql).toContain('left("game_mode",240)');
  expect(query.sql).toContain('"observed_at" >=');
  expect(query.sql).toContain('"observed_at" <');
  expect(result?.observations[0].currentPlayers).toBe(0);
  expect(result?.observations[0]).not.toHaveProperty("cursorTime");
});
it("evaluates current administrator and organization grants in the same snapshot", async () => {
  await repository.pageObservations(
    { id: "server" },
    { kind: "managed", actorId: "manager" },
    24,
    filters,
  );
  expect(state.queries[0].sql).toContain('"users"');
  expect(state.queries[0].sql).toContain('"organizations"');
  expect(state.queries[0].sql).toContain('"organization_members"');
  expect(state.queries[0].params).toContain("manager");
  expect(state.queries[0].params).toContain("admin");
  expect(state.queries[0].params).toContain('["manage_servers"]');
});
it("does not read observations for an unavailable or revoked target", async () => {
  state.rows = [[]];
  expect(
    await repository.pageObservations({ id: "private" }, { kind: "public" }, 24, filters),
  ).toBeNull();
  expect(state.queries).toHaveLength(1);
});
it.each(["known", "unknown", "zero"] as const)(
  "keeps %s player records distinct and escapes literal search",
  async (players) => {
    await repository.pageObservations({ id: "server" }, { kind: "public" }, 24, {
      ...filters,
      players,
      query: "Lua%_\\",
      password: "unknown",
      responding: "no",
    });
    const query = state.queries[1];
    expect(query.params).toContain("%Lua\\%\\_\\\\%");
    expect(query.sql).toContain('"server_observations"."passworded" is null');
    expect(query.params).toContain(false);
    if (players === "known")
      expect(query.sql).toContain('"server_observations"."current_players" is not null');
    if (players === "unknown")
      expect(query.sql).toContain('"server_observations"."current_players" is null');
    if (players === "zero") expect(query.params).toContain(0);
  },
);
it("retains exact tie keys in a 25-row sentinel page and continues without reading an anchor", async () => {
  state.rows[1] = Array.from({ length: 26 }, (_, i) => row(`obs_${i}`));
  const result = await repository.pageObservations(
    { id: "server" },
    { kind: "public" },
    24,
    filters,
  );
  expect(result?.observations).toHaveLength(25);
  expect(result?.nextCursor).toEqual({ createdAt: exact, id: "obs_24" });
  expect(result?.previousCursor).toBeNull();
  state.queries = [];
  state.rows = [[server], [row("older")]];
  await repository.pageObservations({ id: "server" }, { kind: "public" }, 24, {
    ...filters,
    cursor: { createdAt: exact, id: "deleted-anchor", context: context(), direction: "older" },
  });
  expect(state.queries).toHaveLength(2);
  expect(state.queries[1].params).toContain(exact);
  expect(state.queries[1].params).toContain("deleted-anchor");
  expect(state.queries[1].sql).toContain(
    '("server_observations"."observed_at","server_observations"."id") <',
  );
});
