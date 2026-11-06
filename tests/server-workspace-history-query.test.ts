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

it("reads current authority, database clock and at most 21 safe audit projections in one snapshot", async () => {
  const result = await repo.managedServerHistory("server", "actor", filters);
  expect(result.events).toHaveLength(1);
  expect(result.until).toBe(until);
  expect(state.options).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(3);
  expect(state.queries[0].sql).toContain('"users"."role" =');
  expect(state.queries[1].sql).toContain("current_timestamp");
  const read = state.queries[2];
  expect(read.params).toContain(until);
  expect(read.params.at(-1)).toBe(21);
  expect(read.sql).not.toMatch(/offset|count\(/u);
  const selected = read.sql.split(' from "audit_events"')[0];
  for (const secret of ["email", "password_hash", "user_agent", "ip_address", "token_digest"])
    expect(selected).not.toContain(`"${secret}"`);
  expect(selected).not.toContain('"audit_events"."details",');
  expect(read.sql).toContain("jsonb_array_elements_text");
});
it.each(["listing", "visibility", "control", "verification"] as const)(
  "filters the existing action allowlist and period in SQL (%s)",
  async (action) => {
    await repo.managedServerHistory("server", "actor", { period: "30", action });
    const read = state.queries[2];
    expect(read.params).toContain(30);
    expect(read.sql).toContain("interval '1 day'");
    if (action === "visibility") expect(read.sql).toContain("? 'visibility'");
    if (action === "control")
      expect(read.params).toEqual(
        expect.arrayContaining(["server.claim_challenge_issued", "server.control_proof_recorded"]),
      );
    if (action === "verification") expect(read.params).toContain("server.verification_approved");
  },
);
it("anchors microseconds in SQL and keeps the reviewed cutoff window on later pages", async () => {
  state.rows[2] = Array.from({ length: 21 }, (_, i) => event(`event_${i}`));
  const first = await repo.managedServerHistory("server", "actor", filters);
  expect(first.events).toHaveLength(20);
  expect(first.nextCursor).toEqual({ context: context(), until, id: "event_19" });
  state.queries = [];
  state.rows = [[["server", "Server", "server"]], [["2026-10-13T00:00:00.000000Z"]], []];
  await repo.managedServerHistory("server", "actor", {
    ...filters,
    cursor: first.nextCursor ?? undefined,
  });
  const read = state.queries[2];
  expect(read.params).toContain(until);
  expect(read.params).not.toContain("2026-10-13T00:00:00.000000Z");
  expect(read.sql).toContain('("audit_events"."created_at","audit_events"."id") <');
  expect(read.sql).toContain('"server_history_anchor"."target_id"');
  expect(read.params).toContain("event_19");
});
