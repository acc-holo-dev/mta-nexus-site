import { createHash } from "node:crypto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";
const repository = new ServerObservationRepository(),
  end = new Date("2026-10-11T00:00:00.000Z"),
  exact = "2026-10-10T23:59:00.123456Z";
const filters = {
  end,
  query: "",
  players: "all" as const,
  password: "all" as const,
  responding: "all" as const,
};
const server = ["server", "Server", "server", "public", "active", 0];
const row = (id: string) => [id, exact, 0, 64, "mode", "map", "1.6", false, null];
function context(
  access: "public" | "managed" = "public",
  actor = "",
  extra: Partial<typeof filters> = {},
) {
  const input = { ...filters, ...extra };
  return createHash("sha256")
    .update(
      JSON.stringify([
        1,
        "server-observation-browser",
        "server",
        access,
        actor,
        24,
        end.toISOString(),
        input.query,
        input.players,
        input.password,
        input.responding,
      ]),
    )
    .digest("hex");
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(end);
  state.queries = [];
  state.config = null;
  state.rows = [[server], [row("obs")]];
});
afterEach(() => vi.useRealTimers());
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
  expect(query.params).toContain(end.toISOString());
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
it("selects nearest newer neighbors ascending and returns the page newest first", async () => {
  state.rows[1] = [row("a"), row("b"), row("c")];
  const page = await repository.pageObservations({ id: "server" }, { kind: "public" }, 24, {
    ...filters,
    cursor: { createdAt: exact, id: "old", context: context(), direction: "newer" },
  });
  expect(page?.observations.map((item) => item.id)).toEqual(["c", "b", "a"]);
  expect(state.queries[1].sql).toContain('"server_observations"."observed_at" asc');
  expect(page?.previousCursor).toBeNull();
  expect(page?.nextCursor?.id).toBe("a");
});
it.each([
  { query: "other" },
  { players: "zero" as const },
  { password: "yes" as const },
  { end: new Date("2026-10-10T00:00:00.000Z") },
])("rejects cross-filter/period continuations before observation reads", async (extra) => {
  await expect(
    repository.pageObservations({ id: "server" }, { kind: "public" }, 24, {
      ...filters,
      ...extra,
      cursor: { createdAt: exact, id: "obs", context: context(), direction: "older" },
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(1);
});
it("binds managed continuations to the current account and keeps empty continuations recoverable", async () => {
  await expect(
    repository.pageObservations({ id: "server" }, { kind: "managed", actorId: "other" }, 24, {
      ...filters,
      cursor: {
        createdAt: exact,
        id: "obs",
        context: context("managed", "owner"),
        direction: "older",
      },
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  state.rows = [[server], []];
  const page = await repository.pageObservations({ id: "server" }, { kind: "public" }, 24, {
    ...filters,
    cursor: { createdAt: exact, id: "obs", context: context(), direction: "older" },
  });
  expect(page?.observations).toEqual([]);
  expect(page?.nextCursor).toBeNull();
  expect(page?.previousCursor).toBeNull();
});
it.each([new Date(NaN), new Date(end.getTime() + 1), new Date(end.getTime() - 91 * 86400000)])(
  "bounds period ends before database reads",
  async (end) => {
    await expect(
      repository.pageObservations({ id: "server" }, { kind: "public" }, 24, { ...filters, end }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.queries).toHaveLength(0);
  },
);
