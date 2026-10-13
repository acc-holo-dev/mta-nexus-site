import { expect, it, vi } from "vitest";
import { replayDiscussionNotifications } from "../apps/web/src/lib/services/discussion-notification-replay";
import {
  DiscussionReplayPermanentError,
  isRetryableDiscussionReplayFailure,
  runDiscussionReplayWorker,
} from "../apps/web/src/lib/services/discussion-replay-worker";

const complete = { blocked: false, checkpoint: { completed: true } };
const pending = { blocked: false, checkpoint: { completed: false } };
it("retries failures with bounded backoff, resetting after a successful batch", async () => {
  const run = vi
    .fn()
    .mockRejectedValueOnce(Object.assign(Error("PRIVATE_PROVIDER_DETAIL"), { code: "40001" }))
    .mockResolvedValueOnce({ ...pending, blocked: true })
    .mockResolvedValueOnce(pending)
    .mockRejectedValueOnce(
      Error("wrapped query", { cause: Object.assign(Error("retry"), { code: "ECONNRESET" }) }),
    )
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
it.each([
  "08000",
  "08001",
  "08003",
  "08006",
  "08007",
  "40001",
  "40P01",
  "53100",
  "53200",
  "53300",
  "55P03",
  "57014",
  "57P01",
  "57P02",
  "57P03",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EAI_AGAIN",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
])("retries recognized temporary failure %s through the driver wrapper", (code) => {
  const error = Object.assign(Error("PRIVATE_PROVIDER_DETAIL"), { code });
  expect(isRetryableDiscussionReplayFailure(error)).toBe(true);
  expect(isRetryableDiscussionReplayFailure(Error("query", { cause: error }))).toBe(true);
});
it.each([
  "28P01",
  "42501",
  "42P01",
  "42703",
  "23505",
  "08004",
  "08P01",
  "53400",
  "ENOSPC",
  "EACCES",
  "ENOENT",
  "ENOTFOUND",
  "UNKNOWN",
  40001,
])(
  "stops permanent/configuration/filesystem failure %s without retry or private logs",
  async (code) => {
    const error = Object.assign(Error("PRIVATE_PROVIDER_DETAIL"), { code });
    const run = vi.fn().mockRejectedValue(error),
      wait = vi.fn(),
      reportFailure = vi.fn();
    await expect(
      runDiscussionReplayWorker({ run, wait, reportFailure, stopped: () => false }),
    ).rejects.toBe(error);
    expect(run).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    expect(reportFailure).not.toHaveBeenCalled();
  },
);
it("stops unknown invariant errors and bounded/cyclic malformed cause chains", async () => {
  const error = Error("Replay database scope changed during recovery");
  const run = vi.fn().mockRejectedValue(error),
    wait = vi.fn(),
    reportFailure = vi.fn();
  await expect(
    runDiscussionReplayWorker({ run, wait, reportFailure, stopped: () => false }),
  ).rejects.toBe(error);
  expect(wait).not.toHaveBeenCalled();
  expect(reportFailure).not.toHaveBeenCalled();
  const cyclic: { cause?: unknown } = {};
  cyclic.cause = cyclic;
  const temporary = { code: "40001" };
  expect(isRetryableDiscussionReplayFailure(cyclic)).toBe(false);
  expect(isRetryableDiscussionReplayFailure({ cause: { cause: { cause: temporary } } })).toBe(true);
  expect(
    isRetryableDiscussionReplayFailure({ cause: { cause: { cause: { cause: temporary } } } }),
  ).toBe(false);
  expect(isRetryableDiscussionReplayFailure({ code: "EACCES", cause: temporary })).toBe(false);
  const checkpointFailure = new DiscussionReplayPermanentError("checkpoint", {
    cause: Object.assign(Error("PRIVATE_FILE_PATH"), { code: "ETIMEDOUT" }),
  });
  expect(isRetryableDiscussionReplayFailure(checkpointFailure)).toBe(false);
  expect(isRetryableDiscussionReplayFailure(Error("wrapper", { cause: checkpointFailure }))).toBe(
    false,
  );
  for (const value of [null, undefined, "40001", 40001, {}, Error("unknown")])
    expect(isRetryableDiscussionReplayFailure(value)).toBe(false);
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
