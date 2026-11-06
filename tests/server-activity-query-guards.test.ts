import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createServerActivityQueryDbMock } = await import(
    "./helpers/server-activity-query-harness"
  );
  return createServerActivityQueryDbMock();
});

import { AuditRepository } from "../packages/db/src/repositories/audit";
import {
  installServerActivityQueryHooks,
  serverActivityQueryActor as actor,
  serverActivityQueryState as state,
} from "./helpers/server-activity-query-harness";

installServerActivityQueryHooks();

const repository = new AuditRepository();

it.each([
  [0, 2],
  [-10, 2],
  [3.9, 4],
  [99999, 51],
  [Number.NaN, 21],
  [Number.POSITIVE_INFINITY, 21],
])("bounds a requested page size %s to a sentinel limit %s", async (size, limit) => {
  await repository.pageForManagedServer("server", actor, undefined, size);
  expect(state.queries[1].params.at(-1)).toBe(limit);
});

it.each(["", "../other", "a b", "a".repeat(129), "aud_1' OR true"])(
  "rejects malformed cursors before a database read: %s",
  async (cursor) => {
    await expect(repository.pageForManagedServer("server", actor, cursor)).rejects.toThrow(
      RangeError,
    );
    expect(state.queries).toHaveLength(0);
  },
);

it("requires identities before access or audit lookup", async () => {
  await expect(repository.pageForManagedServer("", actor)).rejects.toThrow(RangeError);
  await expect(
    repository.pageForManagedServer("server", { id: "", role: "admin" }),
  ).rejects.toThrow(RangeError);
  expect(state.queries).toHaveLength(0);
});

it("propagates database failures instead of presenting a misleading empty history", async () => {
  state.failure = new Error("unavailable");
  await expect(repository.pageForManagedServer("server", actor)).rejects.toThrow();
});
