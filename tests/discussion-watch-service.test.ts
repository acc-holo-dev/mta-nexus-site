import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ audience: vi.fn(), page: vi.fn(), store: vi.fn() }));
vi.mock("@nexus/db", () => ({
  followWorkspaceRepository: {
    discussionAudience: mocks.audience,
    discussionFollowers: mocks.page,
  },
  notificationRepository: { createDiscussionReplyWithPush: mocks.store },
}));

import { notifyDiscussionReplies } from "../apps/web/src/lib/services/discussion-follow-notification-service";

const stamp = "2026-10-12T00:00:00.000123Z";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.audience.mockResolvedValue({
    authorId: "writer",
    createdAt: stamp,
    directRecipients: ["owner", "parent"],
  });
  mocks.page.mockResolvedValue({ items: [], nextCursor: null });
  mocks.store.mockResolvedValue({
    state: "stored",
    pushJobs: 0,
    pushQueueState: "no_subscriptions",
  });
});
afterEach(() => vi.useRealTimers());
it("dispatches direct participants first and excludes them and the writer from every follower page", async () => {
  const result = await notifyDiscussionReplies("article", "comment");
  expect(result).toMatchObject({ attempted: 2, stored: 2, failed: 0 });
  expect(mocks.page).toHaveBeenCalledExactlyOnceWith(
    "article",
    stamp,
    ["writer", "owner", "parent"],
    undefined,
  );
  expect(mocks.store.mock.calls.map((call) => call[0].recipientId)).toEqual(["owner", "parent"]);
  expect(mocks.store).toHaveBeenCalledWith({
    recipientId: "owner",
    contentId: "article",
    commentId: "comment",
  });
});
it("walks the whole finite audience beyond one hundred followers with concurrency at most ten", async () => {
  vi.useFakeTimers();
  let active = 0,
    peak = 0;
  mocks.store.mockImplementation(async () => {
    active++;
    peak = Math.max(active, peak);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active--;
    return { state: "stored", pushJobs: 1, pushQueueState: "queued" };
  });
  const cursors = [0, 1, 2].map((i) => ({ id: `f${i}`, createdAt: stamp }));
  for (let page = 0; page < 4; page++)
    mocks.page.mockResolvedValueOnce({
      items: Array.from({ length: page === 3 ? 1 : 50 }, (_, i) => ({
        recipientId: `reader_${page * 50 + i}`,
      })),
      nextCursor: cursors[page] ?? null,
    });
  const work = notifyDiscussionReplies("article", "comment");
  await vi.runAllTimersAsync();
  expect(await work).toMatchObject({ attempted: 153, stored: 153, failed: 0, pushQueued: 153 });
  expect(mocks.page).toHaveBeenCalledTimes(4);
  expect(mocks.page.mock.calls[3]).toEqual([
    "article",
    stamp,
    ["writer", "owner", "parent"],
    cursors[2],
  ]);
  expect(active).toBe(0);
  expect(peak).toBe(10);
});
it.each(["sync", "async"])(
  "continues after isolated %s delivery failure and counts preference and push outcomes",
  async (mode) => {
    mocks.page.mockResolvedValue({
      items: [
        { recipientId: "muted" },
        { recipientId: "duplicate" },
        { recipientId: "removed" },
        { recipientId: "degraded" },
      ],
      nextCursor: null,
    });
    mocks.store.mockImplementation((input) => {
      if (input.recipientId === "owner") {
        if (mode === "sync") throw Error("storage-private");
        return Promise.reject(Error("storage-private"));
      }
      const status: Record<string, string> = {
        muted: "suppressed",
        duplicate: "duplicate",
        removed: "skipped",
      };
      return Promise.resolve({
        state: status[input.recipientId] ?? "stored",
        pushJobs: input.recipientId === "parent" ? 2 : 0,
        pushQueueState: input.recipientId === "degraded" ? "saturated" : "queued",
      });
    });
    expect(await notifyDiscussionReplies("article", "comment")).toEqual({
      attempted: 6,
      stored: 2,
      suppressed: 1,
      duplicate: 1,
      skipped: 1,
      failed: 1,
      pushQueued: 2,
      pushDegraded: 1,
    });
  },
);
it("does no deliveries when the event is unavailable", async () => {
  mocks.audience.mockResolvedValue(null);
  expect(await notifyDiscussionReplies("article", "comment")).toMatchObject({
    attempted: 0,
    skipped: 1,
    failed: 0,
  });
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.store).not.toHaveBeenCalled();
});
it.each(["audience", "page"] as const)(
  "reports an unavailable %s lookup without rejecting the saved-comment callback",
  async (stage) => {
    mocks[stage].mockRejectedValue(Error("private-query"));
    expect(await notifyDiscussionReplies("article", "comment")).toMatchObject({ failed: 1 });
  },
);
it("stops an invalid non-advancing cursor instead of looping indefinitely", async () => {
  mocks.page.mockResolvedValue({ items: [], nextCursor: { id: "same", createdAt: stamp } });
  expect(await notifyDiscussionReplies("article", "comment")).toMatchObject({ failed: 1 });
  expect(mocks.page).toHaveBeenCalledTimes(2);
});

it("bounds recovery to one follower page and resumes after its exact cursor", async () => {
  const cursor = { createdAt: stamp, id: "follow_50" };
  mocks.page.mockResolvedValueOnce({ items: [{ recipientId: "reader" }], nextCursor: cursor });
  expect(
    await notifyDiscussionReplies("article", "comment", { maxFollowerPages: 1 }),
  ).toMatchObject({ failed: 0, nextCursor: cursor });
  expect(mocks.page).toHaveBeenCalledTimes(1);
  mocks.page.mockResolvedValueOnce({ items: [{ recipientId: "next" }], nextCursor: null });
  const result = await notifyDiscussionReplies("article", "comment", {
    cursor,
    maxFollowerPages: 1,
  });
  expect(result.nextCursor).toBeUndefined();
  expect(mocks.page.mock.calls[1][3]).toEqual(cursor);
  expect(mocks.store.mock.calls.map((call) => call[0].recipientId)).toEqual([
    "owner",
    "parent",
    "reader",
    "owner",
    "parent",
    "next",
  ]);
});
it.each(["owner", "reader"])(
  "does not checkpoint a failed recovery recipient %s",
  async (recipient) => {
    mocks.page.mockResolvedValue({
      items: [{ recipientId: "reader" }],
      nextCursor: { createdAt: stamp, id: "after" },
    });
    mocks.store.mockImplementation(async (input) => {
      if (input.recipientId === recipient) throw Error("failure");
      return { state: "stored", pushJobs: 0, pushQueueState: "queued" };
    });
    const result = await notifyDiscussionReplies("article", "comment", { maxFollowerPages: 1 });
    expect(result.failed).toBe(1);
    expect(result.nextCursor).toBeUndefined();
    if (recipient === "owner") expect(mocks.page).not.toHaveBeenCalled();
  },
);
it.each([0, -1, 101, 1.5, NaN])(
  "rejects invalid follower budget %s without dispatch",
  async (maxFollowerPages) => {
    await expect(
      notifyDiscussionReplies("article", "comment", { maxFollowerPages }),
    ).rejects.toThrow("budget");
    expect(mocks.audience).not.toHaveBeenCalled();
  },
);

it.each(["owner", "reader"])(
  "retains the recovery page while pending push admission for %s fails",
  async (recipient) => {
    mocks.page.mockResolvedValue({
      items: [{ recipientId: "reader" }],
      nextCursor: { id: "after", createdAt: stamp },
    });
    mocks.store.mockImplementation(async (input) => ({
      state: "duplicate",
      pushJobs: 0,
      pushQueueState: input.recipientId === recipient ? "saturated" : "queued",
    }));
    const result = await notifyDiscussionReplies("article", "comment", {
      maxFollowerPages: 1,
      repairPush: true,
    });
    expect(result).toMatchObject({ failed: 0, pushPending: 1, pushDegraded: 1 });
    expect(result.nextCursor).toBeUndefined();
    expect(mocks.store.mock.calls.every(([input]) => input.repairPush === true)).toBe(true);
    if (recipient === "owner") expect(mocks.page).not.toHaveBeenCalled();
  },
);
it("keeps ordinary inbox replay non-blocking for degraded push", async () => {
  mocks.store.mockResolvedValue({ state: "duplicate", pushJobs: 0, pushQueueState: "error" });
  const result = await notifyDiscussionReplies("article", "comment", { maxFollowerPages: 1 });
  expect(result).toMatchObject({ failed: 0, pushDegraded: 2 });
  expect(result.pushPending).toBeUndefined();
  expect(mocks.store.mock.calls.every(([input]) => input.repairPush === undefined)).toBe(true);
});
