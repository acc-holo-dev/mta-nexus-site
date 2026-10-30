import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en",
  cleanup: null as (() => void) | null,
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: (effect: () => () => void) => {
    h.cleanup ??= effect();
  },
  useState: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = initial;
    return [
      h.slots[i],
      (v: unknown) => {
        h.slots[i] = typeof v === "function" ? (v as (p: unknown) => unknown)(h.slots[i]) : v;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.cursor++;
    if (!(i in h.slots)) h.slots[i] = { current: initial };
    return h.slots[i];
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: h.locale }),
}));

import { ResourceReleaseWatchControl } from "../apps/web/src/components/resource-release-watch-control";
import { resourceReleaseWatchesCopy } from "../apps/web/src/lib/resource-release-watches-i18n";

type Element = ReactElement<Record<string, unknown>>;
function nodes(n: ReactNode): Element[] {
  if (Array.isArray(n)) return n.flatMap(nodes);
  if (!n || typeof n !== "object" || !("props" in n)) return [];
  const e = n as Element;
  const type = e.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [{ ...e, type: "button" } as Element, ...nodes(e.props.children as ReactNode)];
  }
  return [e, ...nodes(e.props.children as ReactNode)];
}
let watch = {
  productId: "prd_a",
  enabled: false,
  revision: 2,
  updatedAt: new Date("2026-10-12T00:00:00.000Z"),
};
let available = true;
function render() {
  h.cursor = 0;
  return nodes(ResourceReleaseWatchControl({ watch, available }));
}
function button(label: string) {
  const b = render().find((n) => n.type === "button" && n.props.children === label);
  if (!b) throw new Error(`Missing ${label}`);
  return b;
}
async function click(label: string) {
  await (button(label).props.onClick as () => Promise<void>)();
}
const ack = {
  productId: "prd_a",
  enabled: true,
  revision: 3,
  updatedAt: "2026-10-12T00:00:00.001Z",
};
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.cleanup = null;
  h.locale = "en";
  available = true;
  watch = {
    productId: "prd_a",
    enabled: false,
    revision: 2,
    updatedAt: new Date("2026-10-12T00:00:00.000Z"),
  };
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("window", { location: { reload: h.reload } });
});
afterEach(() => vi.unstubAllGlobals());
it.each(["en", "ru"])(
  "freezes the original resource and revision for a lost-response retry in %s",
  async (locale) => {
    h.locale = locale;
    const copy = resourceReleaseWatchesCopy(locale as "en" | "ru");
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await click(copy.watch);
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ enabled: true, expectedRevision: 2 });
    watch = { ...watch, productId: "prd_other", revision: 8 };
    h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack });
    await click(copy.retrySame);
    expect(h.fetch.mock.calls[1][0]).toBe(url);
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);
it.each([401, 404, 409])("requires reload after a definitive error %s", async (status) => {
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ code: "RELEASE_WATCH_CONFLICT" }),
  });
  const stale = button("Notify me about new versions").props.onClick as () => Promise<void>;
  await stale();
  await stale();
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(
    render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  await click("Reload current state");
  expect(h.reload).toHaveBeenCalledOnce();
});
it.each([
  { ...ack, productId: "prd_other" },
  { ...ack, enabled: false },
  { ...ack, revision: 4 },
  { ...ack, updatedAt: "invalid" },
  { ...ack, updatedAt: "2026-10-12T00:00:00.000Z" },
  { ...ack, updatedAt: "2027" },
])("keeps an invalid acknowledgement unconfirmed", async (body) => {
  h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
  await click("Notify me about new versions");
  expect(h.refresh).not.toHaveBeenCalled();
  expect(button("Retry the same request").props.disabled).toBe(false);
});
it("coalesces duplicate handlers and does not resend after success", async () => {
  let resolve: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const action = button("Notify me about new versions").props.onClick as () => Promise<void>;
  const first = action();
  await action();
  expect(h.fetch).toHaveBeenCalledOnce();
  resolve({ ok: true, status: 200, json: async () => ack });
  await first;
  await action();
  expect(h.fetch).toHaveBeenCalledOnce();
});
it("aborts on unmount and ignores a late success", async () => {
  let resolve: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const action = button("Notify me about new versions").props.onClick as () => Promise<void>;
  const pending = action();
  const signal = h.fetch.mock.calls[0][1].signal as AbortSignal;
  h.cleanup?.();
  expect(signal.aborted).toBe(true);
  resolve({ ok: true, status: 200, json: async () => ack });
  await pending;
  expect(h.refresh).not.toHaveBeenCalled();
});
it("allows an unavailable enabled resource to be stopped", async () => {
  available = false;
  watch = { ...watch, enabled: true };
  h.fetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ ...ack, enabled: false }),
  });
  expect(button("Stop release notifications").props.disabled).toBe(false);
  await click("Stop release notifications");
  expect(h.refresh).toHaveBeenCalledOnce();
});
