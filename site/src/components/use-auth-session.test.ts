import { afterEach, beforeEach, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  effects: [] as Array<{ deps: unknown[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>,
  cursor: 0,
  fetch: vi.fn(),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/market" }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initial;
      return [
        harness.slots[index],
        (next: unknown) => {
          harness.slots[index] =
            typeof next === "function"
              ? (next as (value: unknown) => unknown)(harness.slots[index])
              : next;
        },
      ];
    },
    useEffect: (effect: () => undefined | (() => void), deps: unknown[]) => {
      const index = harness.cursor++;
      const previous = harness.effects[index];
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
        harness.pending.push(() => {
          previous?.cleanup?.();
          const cleanup = effect();
          harness.effects[index] = {
            deps,
            cleanup: typeof cleanup === "function" ? cleanup : undefined,
          };
        });
      }
    },
  };
});

import { requestShellSessionRefresh } from "./shell-session-refresh";
import { useAuthSession } from "./use-auth-session";

function render() {
  harness.cursor = 0;
  // biome-ignore lint/correctness/useHookAtTopLevel: The mocked dispatcher renders this hook explicitly.
  const state = useAuthSession();
  for (const effect of harness.pending.splice(0)) effect();
  return state;
}
beforeEach(() => {
  harness.slots = [];
  harness.effects = [];
  harness.pending = [];
  harness.fetch.mockReset();
  vi.stubGlobal("fetch", harness.fetch);
  const listeners = new Map<string, Set<() => void>>();
  vi.stubGlobal("window", {
    setTimeout,
    clearTimeout,
    addEventListener: (type: string, listener: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener: (type: string, listener: () => void) =>
      listeners.get(type)?.delete(listener),
    dispatchEvent: (event: Event) => {
      for (const listener of listeners.get(event.type) ?? []) listener();
      return true;
    },
  });
});
afterEach(() => {
  for (const effect of harness.effects) effect?.cleanup?.();
  vi.unstubAllGlobals();
});

it("shows unavailable after a failed probe and recovers only after a confirmed retry", async () => {
  harness.fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "unavailable" }) });
  harness.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      authenticated: true,
      user: { id: "usr_1", username: "member", role: "user" },
    }),
  });
  expect(render().status).toBe("loading");
  await vi.waitFor(() => expect(render().status).toBe("unavailable"));
  const failed = render();
  if (failed.status !== "unavailable") throw new Error("expected retryable session error");
  failed.retry();
  render();
  expect(render().status).toBe("loading");
  await vi.waitFor(() =>
    expect(render()).toEqual({
      status: "authenticated",
      user: { username: "member", role: "user" },
    }),
  );
  expect(harness.fetch).toHaveBeenCalledTimes(2);
});

it("does not present malformed successful responses as anonymous", async () => {
  harness.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ authenticated: false }) });
  render();
  await vi.waitFor(() => expect(render().status).toBe("unavailable"));
});

it("ignores an old response after a newer session refresh", async () => {
  let finishOld!: (response: unknown) => void;
  harness.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  harness.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      authenticated: true,
      user: { id: "usr_new", username: "new-member", role: "user" },
    }),
  });
  render();
  requestShellSessionRefresh();
  render();
  await vi.waitFor(() => expect(render().status).toBe("authenticated"));
  const oldJson = vi.fn(async () => ({ authenticated: false, user: null }));
  finishOld({ ok: true, json: oldJson });
  await vi.waitFor(() => expect(oldJson).toHaveBeenCalledOnce());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(render()).toEqual({
    status: "authenticated",
    user: { username: "new-member", role: "user" },
  });
});
