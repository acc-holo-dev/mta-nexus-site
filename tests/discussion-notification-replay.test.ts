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
