import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createSupportWorkspaceQueryDbMock } = await import(
    "./helpers/support-workspace-query-harness"
  );
  return createSupportWorkspaceQueryDbMock();
});

vi.mock("../packages/db/src/repositories/web-push-admission-recovery", async () => {
  const { createSupportWorkspaceQueryWebPushMock } = await import(
    "./helpers/support-workspace-query-harness"
  );
  return createSupportWorkspaceQueryWebPushMock();
});

import { supportCaseRepository as cases } from "../packages/db/src/repositories/support";
import { supportActivityRepository as activity } from "../packages/db/src/repositories/support-activity";
import {
  supportWorkspaceQueryAudit as audit,
  supportWorkspaceQueryId as id,
  installSupportWorkspaceQueryHooks,
  supportWorkspaceQueryLater as later,
  supportWorkspaceQueryReply as reply,
  supportWorkspaceQueryRequest as request,
  supportWorkspaceQueryRow as row,
  supportWorkspaceQueryState as state,
  supportWorkspaceQueryTime as time,
  supportWorkspaceQueryWrites as writes,
} from "./helpers/support-workspace-query-harness";

installSupportWorkspaceQueryHooks();

it("persists staff replies, reservation, audit and requester notification under live authority", async () => {
  state.rows = [
    [["staff", "moderator"]],
    [row()],
    [["request"]],
    [row({ updatedAt: later })],
    [["message", id, "staff", "staff", "Sensitive reply", later]],
  ];
  expect(
    (
      await cases.addIdempotentMessage(
        reply,
        { ...audit, actorId: "staff" },
        request,
        "current-token",
      )
    ).kind,
  ).toBe("created");
  expect(writes("support_mutation_requests")).toHaveLength(1);
  expect(writes("notifications")).toHaveLength(1);
  expect(writes("notifications")[0].params.join()).not.toContain("Sensitive reply");
  expect(writes("audit_events")[0].params).toContain("admin");
});
it("refuses forged staff author labels even for an authorized requester", async () => {
  state.rows = [[["owner", "user"]], [row()]];
  await expect(
    cases.addIdempotentMessage(
      { ...reply, authorId: "owner" },
      audit,
      {
        ...request,
        actorId: "owner",
      },
      "current-token",
    ),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(writes("support_mutation_requests")).toHaveLength(0);
});
it("returns stale when a same-status case revision changed without writing a reply", async () => {
  state.rows = [[["staff", "moderator"]], [row({ updatedAt: later })], [["request"]]];
  expect(
    (
      await cases.addIdempotentMessage(
        reply,
        { ...audit, actorId: "staff" },
        request,
        "current-token",
      )
    ).kind,
  ).toBe("stale");
  expect(writes("support_case_messages")).toHaveLength(0);
});
it("filters requester search before count and LIMIT with escaped literal wildcards in one snapshot", async () => {
  state.rows = [[[26]], []];
  const page = await cases.pageByRequester("owner", 2, 25, {
    query: "%_\\",
    status: "resolved",
    category: "account",
  });
  expect(page.page).toBe(2);
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  for (const q of state.queries) {
    expect(q.sql).toContain('"support_cases"."requester_id" =');
    expect(q.sql).toContain('"support_cases"."subject" ilike');
    expect(q.params).toContain("owner");
    expect(q.params).toContain("%\\%\\_\\\\%");
  }
  expect(state.queries[1].sql).toContain(
    'order by "support_cases"."updated_at" desc, "support_cases"."id" desc',
  );
  expect(state.queries[1].params.slice(-2)).toEqual([25, 25]);
});
it("refuses a revoked staff queue before selecting any case", async () => {
  state.rows = [[["staff", "user"]]];
  await expect(cases.pageStaff(1, 25, {}, "staff")).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries).toHaveLength(1);
});
it("returns only status labels with bounded history and an opaque cursor after private access", async () => {
  state.rows = [
    [["owner", "user"]],
    [row()],
    Array.from({ length: 21 }, (_, i) => [`audit_${i}`, "open", "resolved", "staff", time]),
  ];
  const result = await activity.history(id, "owner");
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toBe("audit_19");
  const q = state.queries.at(-1);
  if (!q) throw new Error("Missing query");
  expect(q.params).toContain(id);
  expect(q.params.at(-1)).toBe(21);
  expect(q.params).toContain("support.case.status_changed");
  expect(q.params).not.toContain("support.message.created");
  expect(q.sql).not.toContain('"audit_events"."details",');
  expect(q.sql).not.toContain('"audit_events"."ip_address"');
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
});
it("resolves a history cursor only inside the same case and preserves microseconds", async () => {
  state.rows = [[["owner", "user"]], [row()], [["anchor", "2026-10-11T00:00:00.123456Z"]], []];
  await activity.history(id, "owner", "anchor");
  expect(state.queries[2].params).toContain(id);
  expect(state.queries[2].sql).toContain("HH24:MI:SS.US");
  expect(state.queries[3].params).toContain("2026-10-11T00:00:00.123456Z");
});
it("reports foreign or expired history anchors rather than silently returning another page", async () => {
  state.rows = [[["owner", "user"]], [row()], []];
  await expect(activity.history(id, "owner", "missing")).rejects.toMatchObject({
    code: "SUPPORT_ACTIVITY_EXPIRED",
  });
  expect(state.queries).toHaveLength(3);
});
