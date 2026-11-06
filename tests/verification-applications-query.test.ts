import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createVerificationApplicationsQueryDbMock } = await import(
    "./helpers/verification-applications-query-harness"
  );
  return createVerificationApplicationsQueryDbMock();
});

vi.mock("../packages/db/src/repositories/web-push-admission-recovery", async () => {
  const { createVerificationApplicationsQueryWebPushMock } = await import(
    "./helpers/verification-applications-query-harness"
  );
  return createVerificationApplicationsQueryWebPushMock();
});

import { verificationWorkspaceRepository as repo } from "../packages/db/src/repositories/verification-workspace";
import {
  verificationApplicationsQueryContext as context,
  verificationApplicationsQueryFilters as filters,
  installVerificationApplicationsQueryHooks,
  verificationApplicationsQueryStamp as stamp,
  verificationApplicationsQueryState as state,
  verificationApplicationsQueryTime as time,
} from "./helpers/verification-applications-query-harness";

installVerificationApplicationsQueryHooks();

it("bounds own history at twenty summaries with exact stable keyset order and no account or evidence URL", async () => {
  state.rows = [
    Array.from({ length: 21 }, (_, index) => [
      `request_${21 - index}`,
      "developer",
      "pending",
      time,
      null,
      "Excerpt",
    ]),
  ];
  const result = await repo.applications("actor", filters);
  expect(result.items).toHaveLength(20);
  expect(JSON.parse(result.olderCursor ?? "")).toMatchObject({
    context,
    createdAt: time,
    id: "request_2",
    direction: "older",
  });
  expect(state.queries).toHaveLength(1);
  const query = state.queries[0];
  expect(query.sql).not.toContain("offset");
  expect(query.sql.split(" from ")[0]).not.toMatch(
    /requester_id|reviewer_id|proof_url|details|email/u,
  );
  expect(query.params).toContain("actor");
  expect(query.params.at(-1)).toBe(21);
});
it("escapes search and filters before limiting, and reads nearest newer rows without an anchor lookup", async () => {
  await repo.applications("actor", { query: "%_\\", status: "pending", type: "developer" });
  expect(state.queries[0].params).toEqual(
    expect.arrayContaining(["%\\%\\_\\\\%", "pending", "developer", 21]),
  );
  state.queries = [];
  state.rows = [
    [
      ["near", "developer", "pending", time, null, ""],
      ["latest", "developer", "pending", time, null, ""],
    ],
  ];
  const result = await repo.applications("actor", {
    ...filters,
    cursor: { id: "removed", createdAt: time, context, direction: "newer" },
  });
  expect(result.items.map((item) => item.id)).toEqual(["latest", "near"]);
  expect(result.olderCursor).not.toBeNull();
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toContain(") > (");
  expect(state.queries[0].sql).toContain('"created_at" asc, "verification_requests"."id" asc');
});
it.each(["actor", "type", "status", "query"])(
  "rejects history cursor context changes %s before SQL",
  async (changed) => {
    await expect(
      repo.applications(changed === "actor" ? "foreign" : "actor", {
        ...filters,
        [changed]: "changed",
        cursor: { id: "request", createdAt: time, context, direction: "older" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(0);
  },
);
it("denies foreign detail before reading audit or professional data", async () => {
  await expect(repo.application("foreign", "request")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toContain("foreign");
});
it.each([stamp, "outdated", null])(
  "compares submitted evidence to current profile and returns only twenty narrow activity events (%s)",
  async (submitted) => {
    state.rows = [
      [
        [
          "request",
          "developer",
          "actor",
          "pending",
          "https://example.test",
          "notes",
          null,
          false,
          time,
          null,
          "submission",
          submitted,
        ],
      ],
      [[["Lua"], "https://example.test"]],
      Array.from({ length: 21 }, (_, i) => [
        `audit_${i}`,
        "verification.application_updated",
        time,
      ]),
    ];
    const result = await repo.application("actor", "request");
    expect(result.profileState).toBe(
      submitted === stamp ? "current" : submitted ? "changed" : "unknown",
    );
    expect(result.events).toHaveLength(20);
    expect(result.hasEarlierEvents).toBe(true);
    expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
    const selected = state.queries[2].sql.split(" from ")[0];
    expect(selected).not.toMatch(/actor_id|details|ip_address|user_agent/u);
    expect(state.queries[0].sql).toContain("left join lateral");
  },
);
