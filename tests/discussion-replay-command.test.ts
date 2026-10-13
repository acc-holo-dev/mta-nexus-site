import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  identity: vi.fn(),
  clock: vi.fn(),
  preview: vi.fn(),
  page: vi.fn(),
  storage: vi.fn(),
  save: vi.fn(),
  deliver: vi.fn(),
  replay: vi.fn(),
}));
vi.mock("@nexus/db", () => ({ closeDatabaseConnection: mocks.close }));
vi.mock("../apps/web/scripts/discussion-replay-database", () => ({
  resolveDiscussionReplayDatabaseIdentity: mocks.identity,
  assertDiscussionReplayClosedWindow: mocks.clock,
  previewDiscussionReplay: mocks.preview,
  readDiscussionReplayPage: mocks.page,
}));
vi.mock("../apps/web/scripts/discussion-replay-storage", () => ({
  withDiscussionReplayCheckpoint: mocks.storage,
}));
vi.mock("../apps/web/src/lib/services/discussion-follow-notification-service", () => ({
  notifyDiscussionReplies: mocks.deliver,
}));
vi.mock("../apps/web/src/lib/services/discussion-notification-replay", () => ({
  replayDiscussionNotifications: mocks.replay,
}));

const from = "2026-10-12T00:00:00.000001Z",
  until = "2026-10-12T01:00:00.000002Z";
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
let originalSignals: Record<"SIGTERM" | "SIGINT", ReturnType<typeof process.listeners>>;
let logs: ReturnType<typeof vi.spyOn>,
  errors: ReturnType<typeof vi.spyOn>,
  warnings: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  process.exitCode = undefined;
  process.argv = ["node", "replay.ts", "/PRIVATE_CHECKPOINT/replay.json", from, until];
  originalSignals = { SIGTERM: process.listeners("SIGTERM"), SIGINT: process.listeners("SIGINT") };
  logs = vi.spyOn(console, "log").mockImplementation(() => {});
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
  warnings = vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.identity.mockResolvedValue("1".repeat(64));
  mocks.clock.mockResolvedValue(until);
  mocks.close.mockResolvedValue(undefined);
  mocks.preview.mockResolvedValue({ dryRun: true, matchingComments: 0, checkpoint: "ignored" });
  mocks.storage.mockImplementation(async (_path, _from, _until, _scope, callback) =>
    callback({
      initial: { version: 1, from, until, cursor: null, completed: false },
      save: mocks.save,
    }),
  );
  mocks.save.mockResolvedValue(undefined);
  mocks.replay.mockResolvedValue({
    processed: 0,
    blocked: false,
    checkpoint: { completed: true },
    metrics: {},
  });
});
afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    for (const listener of process.listeners(signal)) {
      if (!originalSignals[signal].includes(listener)) process.removeListener(signal, listener);
    }
  }
  vi.restoreAllMocks();
});
const invoke = () => import("../apps/web/scripts/replay-discussion-notifications");
it.each([false, true])(
  "routes preview policy repair=%s without checkpoint/dispatcher/worker side effects",
  async (repairPush) => {
    process.argv.push("--dry-run", ...(repairPush ? ["--repair-push"] : []));
    await invoke();
    expect(mocks.preview).toHaveBeenCalledExactlyOnceWith({ from, until, limit: 100, repairPush });
    for (const mutation of [
      mocks.storage,
      mocks.save,
      mocks.deliver,
      mocks.replay,
      mocks.identity,
      mocks.clock,
    ])
      expect(mutation).not.toHaveBeenCalled();
    expect(logs).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ dryRun: true, matchingComments: 0, checkpoint: "ignored" }),
    );
    expect(process.exitCode).toBeUndefined();
    expect(mocks.close).toHaveBeenCalledTimes(1);
  },
);
it("rejects preview with worker/adoption before even reading database scope", async () => {
  process.argv.push("--dry-run", "--worker");
  await invoke();
  for (const operation of [mocks.preview, mocks.identity, mocks.storage, mocks.replay])
    expect(operation).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
  expect(mocks.close).toHaveBeenCalledTimes(1);
});
it("rejects a future window before opening or modifying a checkpoint", async () => {
  mocks.clock.mockRejectedValue(Error("future window PRIVATE_DATABASE"));
  await invoke();
  expect(mocks.storage).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.replay).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
  expect(errors.mock.calls.flat().join(" ")).not.toMatch(/PRIVATE/);
});
it("retains nonzero/redacted preview failure without entering a delivery path", async () => {
  process.argv.push("--dry-run");
  mocks.preview.mockRejectedValue(Error("PRIVATE_DATABASE_PASSWORD"));
  await invoke();
  expect(mocks.storage).not.toHaveBeenCalled();
  expect(mocks.deliver).not.toHaveBeenCalled();
  expect(logs).not.toHaveBeenCalled();
  expect(errors.mock.calls.flat().join(" ")).not.toMatch(/PRIVATE/);
  expect(process.exitCode).toBe(1);
  expect(mocks.close).toHaveBeenCalledTimes(1);
});
it("rechecks scope/clock each pass and uses the shared bounded source query", async () => {
  mocks.replay.mockImplementation(async (_checkpoint, dependencies) => {
    await dependencies.page(null);
    await dependencies.deliver("content", "comment", undefined);
    return { processed: 1, blocked: false, checkpoint: { completed: true }, metrics: {} };
  });
  await invoke();
  expect(mocks.identity).toHaveBeenCalledTimes(2);
  expect(mocks.clock).toHaveBeenCalledTimes(2);
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(mocks.page).toHaveBeenCalledExactlyOnceWith(from, until, null);
  expect(mocks.deliver).toHaveBeenCalledExactlyOnceWith("content", "comment", {
    cursor: undefined,
    maxFollowerPages: 1,
  });
  expect(process.exitCode).toBeUndefined();
});
it("exits worker on changed scope without repeated passes, warning loops or private logs", async () => {
  process.argv.push("--worker");
  mocks.identity.mockResolvedValueOnce("1".repeat(64)).mockResolvedValueOnce("2".repeat(64));
  await invoke();
  expect(mocks.identity).toHaveBeenCalledTimes(2);
  expect(mocks.replay).not.toHaveBeenCalled();
  expect(warnings).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
  expect(errors.mock.calls.flat().join(" ")).not.toMatch(/PRIVATE|111111|222222/);
  expect(mocks.close).toHaveBeenCalledTimes(1);
});
it("stops worker on a regressed database clock before a page or progress write", async () => {
  process.argv.push("--worker");
  mocks.clock.mockResolvedValueOnce(until).mockRejectedValueOnce(Error("clock changed"));
  await invoke();
  expect(mocks.replay).not.toHaveBeenCalled();
  expect(mocks.save).toHaveBeenCalledTimes(1);
  expect(warnings).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
});
it("treats failed durable progress as permanent even when its I/O code resembles a network timeout", async () => {
  process.argv.push("--worker");
  mocks.save
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(Object.assign(Error("PRIVATE_CHECKPOINT"), { code: "ETIMEDOUT" }));
  mocks.replay.mockImplementation(async (checkpoint, dependencies) => {
    await dependencies.save({ ...checkpoint, completed: true });
    throw Error("must not reach successful completion");
  });
  await invoke();
  expect(mocks.replay).toHaveBeenCalledTimes(1);
  expect(mocks.save).toHaveBeenCalledTimes(2);
  expect(warnings).not.toHaveBeenCalled();
  expect(process.exitCode).toBe(1);
  expect(errors.mock.calls.flat().join(" ")).not.toMatch(/PRIVATE|ETIMEDOUT/);
  expect(mocks.close).toHaveBeenCalledTimes(1);
});
