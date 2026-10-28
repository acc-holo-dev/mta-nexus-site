import { expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { startBrowserMemoryProbe } from "../scripts/browser-memory.mjs";

// /proc can expose a different PID namespace than process.pid in sandboxes.
const currentPid = Number(
  (await readFile("/proc/self/status", "utf8")).match(/^Pid:\s+(\d+)$/mu)?.[1],
);

function browserWithSession(send: ReturnType<typeof vi.fn>) {
  const session = { send, detach: vi.fn().mockResolvedValue(undefined) };
  return { session, browser: { newBrowserCDPSession: vi.fn().mockResolvedValue(session) } };
}

it("detaches the CDP session when initial sampling fails", async () => {
  const failure = new Error("CDP unavailable");
  const { browser, session } = browserWithSession(vi.fn().mockRejectedValue(failure));
  await expect(startBrowserMemoryProbe(browser)).rejects.toBe(failure);
  expect(session.detach).toHaveBeenCalledOnce();
});

it("samples actual process RSS and detaches after completion", async () => {
  const { browser, session } = browserWithSession(
    vi.fn().mockResolvedValue({
      processInfo: [{ id: currentPid }],
    }),
  );
  const stop = await startBrowserMemoryProbe(browser);
  const report = await stop();
  expect(report.baselineRssKiB).toBeGreaterThan(0);
  expect(report.peakRssKiB).toBeGreaterThanOrEqual(report.baselineRssKiB);
  expect(report.samples).toHaveLength(2);
  expect(report.samples.every((sample) => sample.processes === 1)).toBe(true);
  expect(session.detach).toHaveBeenCalledOnce();
});

it("propagates a final sampling error and still detaches", async () => {
  const failure = new Error("Process enumeration failed");
  const { browser, session } = browserWithSession(
    vi
      .fn()
      .mockResolvedValueOnce({ processInfo: [{ id: currentPid }] })
      .mockRejectedValue(failure),
  );
  const stop = await startBrowserMemoryProbe(browser);
  await expect(stop()).rejects.toBe(failure);
  expect(session.detach).toHaveBeenCalledOnce();
});
