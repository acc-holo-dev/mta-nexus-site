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
import {
  supportWorkspaceQueryAudit as audit,
  supportWorkspaceQueryId as id,
  installSupportWorkspaceQueryHooks,
  supportWorkspaceQueryLater as later,
  supportWorkspaceQueryRow as row,
  supportWorkspaceQueryState as state,
  supportWorkspaceQueryTime as time,
  supportWorkspaceQueryWrites as writes,
} from "./helpers/support-workspace-query-harness";

installSupportWorkspaceQueryHooks();

it("resolves an own case under actor/case locks and saves audit plus a generic transactional notice", async () => {
  state.rows = [[["owner", "user"]], [row()], [row({ status: "resolved", updatedAt: later })]];
  const result = await cases.updateStatus(
    id,
    "resolved",
    audit,
    "open",
    "current-token",
    new Date(time),
  );
  expect(result?.status).toBe("resolved");
  expect(state.queries[0].sql).toContain("for share");
  expect(state.queries[1].sql).toContain("for update");
  expect(writes("support_cases")[0].sql).toContain("interval '1 millisecond'");
  expect(writes("audit_events")[0].params).toContain(
    JSON.stringify({ from: "open", to: "resolved" }),
  );
  expect(writes("audit_events")[0].params.join()).not.toContain("secret");
  const notice = writes("notifications")[0];
  expect(notice.params).toContain(`Support case ${id}: resolved.`);
  expect(notice.params).not.toContain("Private subject");
  expect(state.push).toHaveBeenCalledTimes(1);
});
it.each(["open", "resolved"] as const)(
  "allows current owners to transition to %s with a revision",
  async (status) => {
    const from = status === "open" ? "resolved" : "open";
    state.rows = [
      [["owner", "user"]],
      [row({ status: from })],
      [row({ status, updatedAt: later })],
    ];
    expect(
      (await cases.updateStatus(id, status, audit, from, "current-token", new Date(time)))?.status,
    ).toBe(status);
  },
);
it.each([
  { status: "closed" as const, from: "open" as const, version: time },
  { status: "open" as const, from: "closed" as const, version: time },
  { status: "resolved" as const, from: "open" as const, version: undefined },
])(
  "forbids requester closure, staff-closed reopening and unversioned self-service: %j",
  async (input) => {
    state.rows = [[["owner", "user"]], [row({ status: input.from })]];
    await expect(
      cases.updateStatus(
        id,
        input.status,
        audit,
        input.from,
        "current-token",
        input.version ? new Date(input.version) : undefined,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(writes("support_cases")).toHaveLength(0);
  },
);
it("denies an unrelated user, including a moderator whose role was revoked before the write", async () => {
  state.rows = [[["staff", "user"]], [row()]];
  await expect(
    cases.updateStatus(id, "closed", { ...audit, actorId: "staff" }, "open", "current-token"),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(writes("support_cases")).toHaveLength(0);
});
it("allows live staff to close cases and produces a staff-attributed audit", async () => {
  state.rows = [[["staff", "moderator"]], [row()], [row({ status: "closed", updatedAt: later })]];
  await cases.updateStatus(
    id,
    "closed",
    { ...audit, actorId: "staff" },
    "open",
    "current-token",
    new Date(time),
  );
  expect(writes("audit_events")[0].params).toContain("admin");
});
it.each(["status", "revision"])(
  "rejects a stale %s before audit, status or inbox writes",
  async (stale) => {
    state.rows = [
      [["owner", "user"]],
      [row(stale === "status" ? { status: "resolved" } : { updatedAt: later })],
    ];
    expect(
      await cases.updateStatus(id, "resolved", audit, "open", "current-token", new Date(time)),
    ).toBeNull();
    expect(writes("support_cases")).toHaveLength(0);
    expect(writes("notifications")).toHaveLength(0);
  },
);
it("rechecks authority and revision for a no-op without creating duplicate audit or notices", async () => {
  state.rows = [[["owner", "user"]], [row({ status: "resolved" })]];
  expect(
    (await cases.updateStatus(id, "resolved", audit, "resolved", "current-token", new Date(time)))
      ?.status,
  ).toBe("resolved");
  expect(writes("support_cases")).toHaveLength(0);
  expect(writes("notifications")).toHaveLength(0);
  expect(writes("audit_events")).toHaveLength(0);
});
it.each(["audit_events", "notifications"])(
  "propagates %s failure instead of reporting a saved transition",
  async (table) => {
    state.rows = [[["owner", "user"]], [row()], [row({ status: "resolved", updatedAt: later })]];
    state.failTable = table;
    await expect(
      cases.updateStatus(id, "resolved", audit, "open", "current-token", new Date(time)),
    ).rejects.toMatchObject({ cause: expect.objectContaining({ message: "storage failed" }) });
  },
);
it("preserves inbox on optional push failure but propagates intent failure", async () => {
  state.rows = [[["owner", "user"]], [row()], [row({ status: "resolved", updatedAt: later })]];
  state.push.mockResolvedValue({ queued: 0, reason: "error" });
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(
    (await cases.updateStatus(id, "resolved", audit, "open", "current-token", new Date(time)))
      ?.status,
  ).toBe("resolved");
  expect(writes("notifications")).toHaveLength(1);
  expect(warning).toHaveBeenCalled();
  state.rows = [[["owner", "user"]], [row()], [row({ status: "resolved", updatedAt: later })]];
  state.push.mockRejectedValue(new Error("Admission intent failed"));
  await expect(
    cases.updateStatus(id, "resolved", audit, "open", "current-token", new Date(time)),
  ).rejects.toThrow("Admission intent failed");
  warning.mockRestore();
});
it("honors system-notification opt-out under the existing preference lock without undoing the status write", async () => {
  state.rows = [
    [["owner", "user"]],
    [row()],
    [row({ status: "resolved", updatedAt: later })],
    [[false]],
  ];
  expect(
    (await cases.updateStatus(id, "resolved", audit, "open", "current-token", new Date(time)))
      ?.status,
  ).toBe("resolved");
  expect(state.queries.some((q) => q.sql.includes("pg_advisory_xact_lock"))).toBe(true);
  expect(writes("notifications")).toHaveLength(0);
  expect(state.push).not.toHaveBeenCalled();
});
