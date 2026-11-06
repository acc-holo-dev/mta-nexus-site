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
  serverObservationBrowserQueryEnd as end,
  serverObservationBrowserQueryExact as exact,
  serverObservationBrowserQueryFilters as filters,
  serverObservationBrowserQueryRow as row,
  serverObservationBrowserQueryServer as server,
  serverObservationBrowserQueryState as state,
} from "./helpers/server-observation-browser-query-harness";

installServerObservationBrowserQueryHooks();

const repository = new ServerObservationRepository();

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
  async (periodEnd) => {
    await expect(
      repository.pageObservations(
        { id: "server" },
        { kind: "public" },
        24,
        { ...filters, end: periodEnd },
      ),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.queries).toHaveLength(0);
  },
);
