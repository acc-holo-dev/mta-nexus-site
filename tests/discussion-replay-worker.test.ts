import { expect, it, vi } from "vitest";
import { replayDiscussionNotifications } from "../apps/web/src/lib/services/discussion-notification-replay";
import { runDiscussionReplayWorker } from "../apps/web/src/lib/services/discussion-replay-worker";

const complete = { blocked: false, checkpoint: { completed: true } };
const pending = { blocked: false, checkpoint: { completed: false } };
it("retries failures with bounded backoff, resetting after a successful batch", async () => {
  const run = vi
    .fn()
    .mockRejectedValueOnce(Error("PRIVATE_PROVIDER_DETAIL"))
    .mockResolvedValueOnce({ ...pending, blocked: true })
    .mockResolvedValueOnce(pending)
    .mockRejectedValueOnce(Error("retry"))
    .mockResolvedValueOnce(complete);
  const wait = vi.fn().mockResolvedValue(undefined),
    reportFailure = vi.fn();
  expect(
    await runDiscussionReplayWorker({ run, wait, reportFailure, stopped: () => false }),
  ).toEqual({ completed: true });
  expect(wait.mock.calls.map((call) => call[0])).toEqual([1000, 2000, 1000, 1000]);
  expect(reportFailure).toHaveBeenCalledTimes(3);
  expect(reportFailure.mock.calls.every((call) => call.length === 0)).toBe(true);
});
it("caps repeated failures at one minute and stops without another delivery", async () => {
  let stopped = false;
  const run = vi.fn().mockResolvedValue({ ...pending, blocked: true });
  const delays: number[] = [];
  expect(
    await runDiscussionReplayWorker({
      run,
      reportFailure: vi.fn(),
      stopped: () => stopped,
      wait: async (value) => {
        delays.push(value);
        if (delays.length === 10) stopped = true;
      },
    }),
  ).toEqual({ completed: false });
  expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000, 60000]);
  expect(run).toHaveBeenCalledTimes(10);
});
it("does not start or wait after a shutdown request", async () => {
  const run = vi.fn(),
    wait = vi.fn();
  await runDiscussionReplayWorker({ run, wait, reportFailure: vi.fn(), stopped: () => true });
  expect(run).not.toHaveBeenCalled();
  expect(wait).not.toHaveBeenCalled();
  let stopped = false;
  run.mockImplementation(async () => {
    stopped = true;
    return pending;
  });
  await runDiscussionReplayWorker({ run, wait, reportFailure: vi.fn(), stopped: () => stopped });
  expect(wait).not.toHaveBeenCalled();
});
it("finishes the active comment and persists it before honoring shutdown", async () => {
  let stopped = false;
  const time = "2026-10-12T00:00:00.000000Z";
  const save = vi.fn();
  const deliver = vi.fn(async () => {
    stopped = true;
    return { failed: 0 };
  });
  const result = await replayDiscussionNotifications(
    { version: 1, from: time, until: time, cursor: null, completed: false },
    {
      page: async () => ["a", "b"].map((id) => ({ id, createdAt: time, contentId: "post" })),
      save,
      deliver,
      shouldStop: () => stopped,
    },
    100,
  );
  expect(deliver).toHaveBeenCalledExactlyOnceWith("post", "a");
  expect(save).toHaveBeenCalledTimes(1);
  expect(result.checkpoint).toMatchObject({ cursor: { id: "a" }, completed: false });
});
it("does not read a page when shutdown was already requested", async () => {
  const page = vi.fn(),
    time = "2026-10-12T00:00:00.000000Z";
  await replayDiscussionNotifications(
    { version: 1, from: time, until: time, cursor: null, completed: false },
    {
      page,
      save: vi.fn(),
      deliver: vi.fn(),
      shouldStop: () => true,
    },
    100,
  );
  expect(page).not.toHaveBeenCalled();
});
