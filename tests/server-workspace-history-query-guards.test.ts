import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createServerWorkspaceHistoryQueryDbMock } = await import(
    "./helpers/server-workspace-history-query-harness"
  );
  return createServerWorkspaceHistoryQueryDbMock();
});

import { AuditRepository } from "../packages/db/src/repositories/audit";
import {
  installServerWorkspaceHistoryQueryHooks,
  serverWorkspaceHistoryQueryContext as context,
  serverWorkspaceHistoryQueryEvent as event,
  serverWorkspaceHistoryQueryFilters as filters,
  serverWorkspaceHistoryQueryState as state,
  serverWorkspaceHistoryQueryUntil as until,
} from "./helpers/server-workspace-history-query-harness";

const repo = new AuditRepository();
installServerWorkspaceHistoryQueryHooks();

it.each(["actor", "server", "action", "period"])(
  "rejects a cursor from another context (%s) after checking live access but before reading events",
  async (kind) => {
    await expect(
      repo.managedServerHistory(
        kind === "server" ? "other" : "server",
        kind === "actor" ? "other" : "actor",
        {
          ...filters,
          ...(kind === "action" ? { action: "visibility" as const } : {}),
          ...(kind === "period" ? { period: "7" as const } : {}),
          cursor: { context: context(), until, id: "audit" },
        },
      ),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(1);
  },
);
it("uses current grants before both history and cursor validation", async () => {
  state.rows = [[]];
  await expect(
    repo.managedServerHistory("server", "revoked", {
      ...filters,
      cursor: { context: "f".repeat(64), until, id: "audit" },
    }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
});
it("exports the same cutoff and rejects future or contradictory cutoff windows", async () => {
  await repo.managedServerHistory("server", "actor", {
    ...filters,
    until: "2026-10-11T00:00:00.000000Z",
  });
  expect(state.queries[2].params).toContain("2026-10-11T00:00:00.000000Z");
  state.queries = [];
  state.rows = [[["server", "Server", "server"]], [[until]]];
  await expect(
    repo.managedServerHistory("server", "actor", {
      ...filters,
      until: "2099-01-01T00:00:00.000000Z",
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(2);
  state.rows = [[["server", "Server", "server"]], [[until]]];
  await expect(
    repo.managedServerHistory("server", "actor", {
      ...filters,
      until: "2026-10-11T00:00:00.000000Z",
      cursor: { context: context(), until, id: "audit" },
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
});
it("preserves valid legacy server-scoped anchors and excludes mixed legacy filters", async () => {
  await repo.managedServerHistory("server", "actor", { ...filters, legacyCursor: "old_audit" });
  expect(state.queries[2].params).toContain("old_audit");
  state.queries = [];
  state.rows = [[["server", "Server", "server"]]];
  await expect(
    repo.managedServerHistory("server", "actor", {
      period: "7",
      action: "all",
      legacyCursor: "old_audit",
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(1);
});
it("does not convert database unavailability into an empty successful history", async () => {
  state.rows = [[["server", "Server", "server"]], []];
  await expect(repo.managedServerHistory("server", "actor", filters)).rejects.toThrow(
    "clock unavailable",
  );
  expect(state.queries).toHaveLength(2);
});
