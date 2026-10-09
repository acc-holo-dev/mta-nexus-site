import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startVisiblePolling } from "./visible-polling";

class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  change(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

describe("visible request polling", () => {
  const cleanups: Array<() => void> = [];
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    for (const stop of cleanups.splice(0)) stop();
    vi.useRealTimers();
  });
  function poll<T>(read: (signal: AbortSignal) => Promise<T>, visibility = new Visibility()) {
    const onValue = vi.fn();
    const onError = vi.fn();
    const stop = startVisiblePolling({ read, onValue, onError, visibility, intervalMs: 1_000 });
    cleanups.push(stop);
    return { onValue, onError, stop, visibility };
  }

  it("coalesces repeated visible events and delays the next read until completion", async () => {
    const pending = deferred<string>();
    const read = vi.fn(() => pending.promise);
    const { visibility, onValue } = poll(read);
    for (let count = 0; count < 10; count++) visibility.change("visible");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    pending.resolve("fresh");
    await vi.advanceTimersByTimeAsync(0);
    expect(onValue).toHaveBeenCalledWith("fresh");
    await vi.advanceTimersByTimeAsync(999);
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps hidden tabs idle and refreshes immediately when visible", async () => {
    const visibility = new Visibility();
    visibility.visibilityState = "hidden";
    const read = vi.fn(async () => "value");
    poll(read, visibility);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    visibility.change("visible");
    expect(read).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    visibility.change("hidden");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts on hiding and ignores stale completion even if the reader ignores cancellation", async () => {
    const old = deferred<string>();
    const fresh = deferred<string>();
    const signals: AbortSignal[] = [];
    const read = vi.fn((signal: AbortSignal) => { signals.push(signal); return signals.length === 1 ? old.promise : fresh.promise; });
    const { visibility, onValue, onError } = poll(read);
    visibility.change("hidden");
    expect(signals[0].aborted).toBe(true);
    visibility.change("visible");
    expect(signals[1].aborted).toBe(false);
    fresh.resolve("fresh");
    await vi.advanceTimersByTimeAsync(0);
    old.resolve("stale");
    await vi.advanceTimersByTimeAsync(0);
    expect(onValue.mock.calls).toEqual([["fresh"]]);
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("reports a real failure once and retries after the configured delay", async () => {
    const error = new Error("Network failed");
    const read = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("recovered");
    const { onValue, onError } = poll(read);
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledExactlyOnceWith(error);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(onValue).toHaveBeenCalledExactlyOnceWith("recovered");
  });

  it("stops requests, timers and listeners on cleanup without surfacing abort failures", async () => {
    const pending = deferred<string>();
    let signal!: AbortSignal;
    const read = vi.fn((value: AbortSignal) => { signal = value; return pending.promise; });
    const { stop, visibility, onValue, onError } = poll(read);
    stop();
    stop();
    expect(signal.aborted).toBe(true);
    pending.reject(new DOMException("Cancelled", "AbortError"));
    visibility.change("visible");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(1);
    expect(onValue).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears an already scheduled refresh when stopped", async () => {
    const read = vi.fn(async () => "value");
    const { stop } = poll(read);
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(read).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, -1, 1.5, Number.NaN, 2_147_483_648])("rejects unsafe timer interval %s before starting", intervalMs => {
    const read = vi.fn(async () => "value");
    expect(() => startVisiblePolling({ read, onValue: vi.fn(), onError: vi.fn(), visibility: new Visibility(), intervalMs })).toThrow("Invalid polling interval");
    expect(read).not.toHaveBeenCalled();
  });
});
