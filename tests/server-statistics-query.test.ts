import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createServerStatisticsQueryDbMock } = await import(
    "./helpers/server-statistics-query-harness"
  );
  return createServerStatisticsQueryDbMock();
});

import { ServerObservationRepository } from "../packages/db/src/repositories/server-observations";
import {
  installServerStatisticsQueryHooks,
  serverStatisticsQueryEnd as end,
  serverStatisticsQueryState as state,
} from "./helpers/server-statistics-query-harness";

const repository = new ServerObservationRepository();
installServerStatisticsQueryHooks();

it("reads both complete disjoint periods, chart and bounded samples in one authority snapshot", async () => {
  const report = await repository.readStatistics({ id: "server" }, { kind: "public" }, 24);
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(4);
  expect(report).toMatchObject({
    summary: {
      observationCount: 8000,
      knownPlayerCount: 7900,
      averagePlayers: 32.5,
      peakPlayers: 100,
    },
    previousSummary: { observationCount: 20, averagePlayers: 12.5 },
    nextCursor: null,
  });
  expect(report?.observations).toHaveLength(1);
  expect(state.queries[0].params).toEqual(["server", "public", "unlisted", 1]);
  expect(state.queries[1].params).toContain("2026-10-10T00:00:00.000Z");
  expect(state.queries[1].params).toContain("2026-10-09T00:00:00.000Z");
  expect(state.queries[1].sql).toContain('group by "period"');
  expect(state.queries[1].sql).not.toContain("limit");
  expect(state.queries[2].sql).toContain('group by "bucket_at"');
  expect(state.queries[3].params.at(-1)).toBe(26);
  for (const query of state.queries.slice(1)) {
    expect(query.params).toContain("mta_master");
    expect(query.params).toContain(end.toISOString());
    expect(query.sql).toContain('"observed_at" <');
    expect(query.sql).not.toContain("offset");
  }
  expect(state.queries[3].sql).not.toContain("source_sequence");
  expect(state.queries[3].sql).not.toContain('"name"');
});
it("rechecks personal, organization grants and actual administrator role without trusting a caller role", async () => {
  await repository.readStatistics(
    { slug: "quoted_'" },
    { kind: "managed", actorId: "manager" },
    24,
  );
  const query = state.queries[0];
  expect(query.params).toContain("quoted_'");
  expect(query.sql).not.toContain("quoted_'");
  expect(query.sql).toContain('"users"."role"');
  expect(query.params).toContain("admin");
  expect(query.sql).toContain('"organization_members"."permissions" @>');
  expect(query.params).toContain('["manage_servers"]');
  expect(query.params).toContain("manager");
  expect(query.sql).toContain('"servers"."organization_id" is null');
});
it("does not read observations for a hidden, missing or unauthorized listing", async () => {
  state.rows = [[]];
  expect(
    await repository.readStatistics({ id: "server" }, { kind: "managed", actorId: "revoked" }, 168),
  ).toBeNull();
  expect(state.queries).toHaveLength(1);
});
it("keeps absent aggregates unknown and zero observations distinct from zero players", async () => {
  state.rows[1] = [];
  state.rows[2] = [];
  state.rows[3] = [];
  const report = await repository.readStatistics({ id: "server" }, { kind: "public" }, 720);
  expect(report?.summary).toEqual({
    observationCount: 0,
    knownPlayerCount: 0,
    observedFrom: null,
    observedTo: null,
    peakPlayers: null,
    averagePlayers: null,
  });
  expect(report?.previousSummary).toEqual(report?.summary);
});
