import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/discussion-moderation-notice", async () => {
  const { discussionTrustQueryState } = await import("./helpers/discussion-trust-query-harness");
  return {
    discussionModerationNotice: discussionTrustQueryState.notice,
  };
});
vi.mock("../packages/db/src/client", async () => {
  const { createDiscussionTrustQueryDbMock } = await import(
    "./helpers/discussion-trust-query-harness"
  );
  return createDiscussionTrustQueryDbMock();
});

import { publicVerificationHistoryRepository as approvals } from "../packages/db/src/repositories/public-verification-history";
import {
  discussionTrustQueryContext as context,
  discussionTrustQueryState as state,
  discussionTrustQueryTime as time,
  installDiscussionTrustQueryHooks,
} from "./helpers/discussion-trust-query-harness";

installDiscussionTrustQueryHooks();

it("reads current flags and only dated public approvals from one read-only repeatable snapshot", async () => {
  state.rows = [
    [["subject", "writer", "Writer", false, true]],
    [["b".repeat(32), "developer", time, time]],
  ];
  const page = await approvals.page("writer", {});
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
  expect(page.subject).toEqual({
    username: "writer",
    name: "Writer",
    identityVerified: false,
    developerVerified: true,
  });
  expect(page.context).toBe(context());
  const query = state.queries[1];
  expect(query.params).toEqual(["subject", "approved", "user", "developer", 21]);
  expect(query.sql).toContain('"verification_requests"."resolved_at" is not null');
  expect(query.sql).toContain('md5("verification_requests"."id")');
  expect(query.sql).not.toMatch(/requester_id|proof_url|review_notes|reviewer_id|created_at/u);
  expect(JSON.stringify(page.subject)).not.toContain("subject");
});
it.each([context("other"), context("subject", "developer")])(
  "rejects approval cursors bound to another subject or filter",
  async (wrong) => {
    state.rows = [[["subject", "writer", "Writer", false, false]]];
    await expect(
      approvals.page("writer", { cursor: { createdAt: time, id: "a".repeat(32), context: wrong } }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(1);
  },
);
it("paginates approval ties using the public opaque key and exact microseconds", async () => {
  state.rows = [
    [["subject", "writer", "Writer", false, false]],
    Array.from({ length: 21 }, (_, i) => [i.toString(16).padStart(32, "0"), "user", time, time]),
  ];
  const page = await approvals.page("writer", {
    type: "user",
    cursor: { createdAt: time, id: "f".repeat(32), context: context("subject", "user") },
  });
  expect(page.items).toHaveLength(20);
  expect(page.nextCursor).toEqual({ createdAt: time, id: (19).toString(16).padStart(32, "0") });
  expect(state.queries[1].params).toEqual([
    "subject",
    "approved",
    "user",
    time,
    "f".repeat(32),
    21,
  ]);
  expect(state.queries[1].sql).toMatch(/\) < \(/u);
  expect(state.queries[1].sql).not.toContain("offset");
});
it("returns 404 for absent approval subjects before querying requests", async () => {
  await expect(approvals.page("missing", {})).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
});
