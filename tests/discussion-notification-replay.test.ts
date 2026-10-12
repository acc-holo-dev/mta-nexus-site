import { expect, it, vi } from "vitest";
import {
  type ReplayCheckpoint,
  replayDiscussionNotifications,
} from "../apps/web/src/lib/services/discussion-notification-replay";

const time = "2026-10-12T00:00:00.000123Z";
const initial: ReplayCheckpoint = {
  version: 1,
  from: time,
  until: time,
  cursor: null,
  completed: false,
};
const rows = ["a", "b", "c"].map((id) => ({ id, createdAt: time, contentId: "content" }));
it("persists an audience page separately and resumes the same event before advancing", async () => {
  const audienceCursor = { createdAt: time, id: "follow_50" };
  const deliver = vi.fn().mockResolvedValueOnce({ failed: 0, nextCursor: audienceCursor });
  const save = vi.fn(),
    page = vi.fn(async () => rows);
  const first = await replayDiscussionNotifications(initial, { page, deliver, save }, 100);
  expect(first).toMatchObject({
    processed: 0,
    blocked: false,
    checkpoint: {
      cursor: null,
      pending: { id: "a", contentId: "content", createdAt: time, audienceCursor },
    },
  });
  deliver.mockResolvedValue({ failed: 0 });
  const second = await replayDiscussionNotifications(first.checkpoint, { page, deliver, save }, 1);
  expect(deliver.mock.calls[1]).toEqual(["content", "a", audienceCursor]);
  expect(second).toMatchObject({
    processed: 1,
    checkpoint: { cursor: { id: "a" }, pending: undefined },
  });
});
it("retains a partial event on failure and rejects non-advancing audience cursors", async () => {
  const audienceCursor = { createdAt: time, id: "follow" };
  const checkpoint = { ...initial, pending: { ...rows[0], audienceCursor } };
  const save = vi.fn(),
    deliver = vi.fn().mockResolvedValue({ failed: 1 });
  const dependencies = { page: async () => rows, save, deliver };
  expect(await replayDiscussionNotifications(checkpoint, dependencies, 10)).toMatchObject({
    blocked: true,
    checkpoint,
  });
  expect(save).not.toHaveBeenCalled();
  deliver.mockResolvedValue({ failed: 0, nextCursor: audienceCursor });
  await expect(replayDiscussionNotifications(checkpoint, dependencies, 10)).rejects.toThrow(
    "audience cursor",
  );
});
it("never applies an orphaned audience cursor to another comment", async () => {
  const checkpoint = {
    ...initial,
    pending: { ...rows[0], audienceCursor: { createdAt: time, id: "follow" } },
  };
  const deliver = vi.fn().mockResolvedValue({ failed: 0 });
  const result = await replayDiscussionNotifications(
    checkpoint,
    { page: async () => rows.slice(1), save: vi.fn(), deliver },
    1,
  );
  expect(deliver).toHaveBeenCalledExactlyOnceWith("content", "b");
  expect(result.checkpoint.pending).toBeUndefined();
});
it("resumes a failed event without skipping later recipients or comments", async () => {
  let saved = initial;
  const page = vi.fn(async (cursor) => rows.filter((row) => !cursor || row.id > cursor.id));
  const deliver = vi.fn().mockResolvedValueOnce({ failed: 0 }).mockResolvedValueOnce({ failed: 1 });
  const save = vi.fn(async (value) => {
    saved = value;
  });
  expect(await replayDiscussionNotifications(initial, { page, deliver, save }, 10)).toMatchObject({
    processed: 1,
    blocked: true,
    checkpoint: { cursor: { id: "a" } },
  });
  deliver.mockResolvedValue({ failed: 0 });
  expect(await replayDiscussionNotifications(saved, { page, deliver, save }, 10)).toMatchObject({
    processed: 2,
    blocked: false,
    checkpoint: { completed: true },
  });
  expect(deliver.mock.calls.map((call) => call[1])).toEqual(["a", "b", "b", "c"]);
});
it("stops at the run budget and keeps a precise cursor for equal timestamps", async () => {
  const save = vi.fn(),
    deliver = vi.fn().mockResolvedValue({ failed: 0 });
  const result = await replayDiscussionNotifications(
    initial,
    { page: async () => rows, deliver, save },
    2,
  );
  expect(result).toMatchObject({
    processed: 2,
    checkpoint: { cursor: { id: "b", createdAt: time }, completed: false },
  });
  expect(deliver).toHaveBeenCalledTimes(2);
});
it("does not deliver a completed window", async () => {
  const page = vi.fn();
  await replayDiscussionNotifications(
    { ...initial, completed: true },
    { page, deliver: vi.fn(), save: vi.fn() },
    1,
  );
  expect(page).not.toHaveBeenCalled();
});
it("retains the last persisted cursor when checkpoint writing fails", async () => {
  const deliver = vi.fn().mockResolvedValue({ failed: 0 });
  await expect(
    replayDiscussionNotifications(
      initial,
      {
        page: async () => rows,
        deliver,
        save: async () => {
          throw Error("disk");
        },
      },
      10,
    ),
  ).rejects.toThrow("disk");
  expect(deliver).toHaveBeenCalledTimes(1);
  expect(initial.cursor).toBeNull();
});
it.each([0, -1, 10001, 1.5, NaN])(
  "rejects invalid budget %s before loading events",
  async (limit) => {
    const page = vi.fn();
    await expect(
      replayDiscussionNotifications(initial, { page, deliver: vi.fn(), save: vi.fn() }, limit),
    ).rejects.toThrow("limit");
    expect(page).not.toHaveBeenCalled();
  },
);
it("rejects a stalled cursor and events outside the fixed window", async () => {
  const deliver = vi.fn();
  for (const row of [{ ...rows[0], createdAt: "2026-10-11T00:00:00.000000Z" }, rows[0]]) {
    await expect(
      replayDiscussionNotifications(
        { ...initial, cursor: rows[0] },
        { page: async () => [row], deliver, save: vi.fn() },
        10,
      ),
    ).rejects.toThrow("window");
  }
  expect(deliver).not.toHaveBeenCalled();
});

it("counts delivered, suppressed, duplicate and degraded attempts without storing private recipient data", async () => {
  const result = await replayDiscussionNotifications(
    initial,
    {
      page: async () => rows,
      deliver: vi
        .fn()
        .mockResolvedValueOnce({
          failed: 0,
          attempted: 10,
          stored: 5,
          suppressed: 2,
          duplicate: 2,
          skipped: 1,
          pushQueued: 3,
          pushDegraded: 1,
        })
        .mockResolvedValueOnce({ failed: 2, attempted: 4, stored: 2 }),
      save: vi.fn(),
    },
    10,
  );
  expect(result).toMatchObject({
    processed: 1,
    blocked: true,
    metrics: {
      deliverySteps: 2,
      attempted: 14,
      stored: 7,
      suppressed: 2,
      duplicate: 2,
      skipped: 1,
      failed: 2,
      pushQueued: 3,
      pushDegraded: 1,
    },
  });
  expect(Object.values(result.metrics).every((value) => typeof value === "number")).toBe(true);
});
it("includes page metrics even when no comment completes and resets metrics on the next pass", async () => {
  const page = async () => rows;
  const deliver = vi
    .fn()
    .mockResolvedValue({
      failed: 0,
      attempted: 50,
      duplicate: 50,
      nextCursor: { createdAt: time, id: "follow_50" },
    });
  const save = vi.fn();
  const result = await replayDiscussionNotifications(initial, { page, deliver, save }, 1);
  expect(result).toMatchObject({
    processed: 0,
    metrics: { deliverySteps: 1, attempted: 50, duplicate: 50 },
  });
  const stopped = await replayDiscussionNotifications(
    result.checkpoint,
    { page, deliver, save, shouldStop: () => true },
    1,
  );
  expect(Object.values(stopped.metrics)).toEqual(Array(9).fill(0));
});
it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  "denies checkpoint advancement for invalid delivery counter %s",
  async (failed) => {
    const save = vi.fn();
    await expect(
      replayDiscussionNotifications(
        initial,
        {
          page: async () => rows,
          deliver: async () => ({ failed }),
          save,
        },
        1,
      ),
    ).rejects.toThrow("counters");
    expect(save).not.toHaveBeenCalled();
  },
);
