import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LocaleProvider } from "./locale-context";
import { NotificationBell } from "./notification-bell";

const effects = vi.hoisted(() => [] as Array<() => void | (() => void)>);
vi.mock("react", async importOriginal => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (setup: () => void | (() => void)) => { effects.push(setup); },
}));
vi.mock("next/link", () => ({ default: "a" }));

class Visibility extends EventTarget {
  visibilityState: DocumentVisibilityState = "visible";
  change(state: DocumentVisibilityState) {
    this.visibilityState = state;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}
let visibility: Visibility;
let fetchMock: ReturnType<typeof vi.fn>;
let cleanups: Array<() => void>;
beforeEach(() => {
  vi.useFakeTimers();
  effects.length = 0;
  cleanups = [];
  visibility = new Visibility();
  fetchMock = vi.fn(() => new Promise<Response>(() => {}));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("document", visibility);
  vi.stubGlobal("window", { setInterval, clearInterval, setTimeout, clearTimeout });
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function startEffects() {
  effects.length = 0;
  // Execute actual effect setup/cleanup from an SSR hook adapter. No DOM mount.
  renderToStaticMarkup(<LocaleProvider locale="en"><NotificationBell /></LocaleProvider>);
  for (const setup of effects) {
    const cleanup = setup();
    if (cleanup) cleanups.push(cleanup);
  }
}

it("coalesces visibility events while the actual notification GET is pending", async () => {
  startEffects();
  for (let count = 0; count < 10; count++) visibility.change("visible");
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("/api/notifications?limit=6", expect.objectContaining({
    cache: "no-store", credentials: "same-origin", signal: expect.any(AbortSignal),
  }));
});

it("cancels the actual GET signal on effect cleanup", () => {
  startEffects();
  const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
  expect(signal.aborted).toBe(false);
  for (const cleanup of cleanups.splice(0)) cleanup();
  expect(signal.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("allows setup-cleanup-setup without retaining the first request", () => {
  startEffects();
  const first = fetchMock.mock.calls[0][1].signal as AbortSignal;
  for (const cleanup of cleanups.splice(0)) cleanup();
  startEffects();
  const second = fetchMock.mock.calls[1][1].signal as AbortSignal;
  visibility.change("visible");
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(first.aborted).toBe(true);
  expect(second.aborted).toBe(false);
});

it("leaves a hidden initial page without requests or polling timers", async () => {
  visibility.visibilityState = "hidden";
  startEffects();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetchMock).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  visibility.change("visible");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
