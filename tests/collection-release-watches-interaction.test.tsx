import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
  locale: "en",
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useEffect: () => {},
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
import { ResourceReleaseWatchBatchControls } from "../apps/web/src/components/resource-release-watch-batch-controls";
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
const items = [
  { productId: "prd_b", enabled: false, revision: 2, title: "Dependency", available: true },
  { productId: "prd_a", enabled: false, revision: 0, title: "Root", available: true },
  { productId: "prd_hidden", enabled: false, revision: 0, title: null, available: false },
  { productId: "prd_enabled", enabled: true, revision: 3, title: "Watched", available: true },
];
let activeWatchCount = 4;
let collectionId = "lcol_a";
function render() {
  h.cursor = 0;
  return nodes(
    ResourceReleaseWatchBatchControls({
      items,
      locale: h.locale as "en" | "ru",
      collection: { id: collectionId, revision: 3, status: "active" },
      activeWatchCount,
    }),
  );
}
function checks() {
  return render().filter((n) => n.type === "input" && n.props.type === "checkbox");
}
function change(n: Element, checked: boolean) {
  (n.props.onChange as (e: unknown) => void)({ target: { checked } });
}
function button(label: string) {
  const b = render().find((n) => n.type === "button" && n.props.children === label);
  if (!b) throw new Error(`Missing ${label}`);
  return b;
}
async function click(label: string) {
  (button(label).props.onClick as () => void)();
  await new Promise((r) => setTimeout(r, 0));
}
function ack(init: RequestInit) {
  const command = JSON.parse(String(init.body));
  return {
    changedCount: command.items.length,
    items: command.items.map((item: { productId: string; expectedRevision: number }) => ({
      productId: item.productId,
      enabled: true,
      revision: item.expectedRevision + 1,
      updatedAt: "2026-10-12T00:00:00.000Z",
    })),
  };
}
function reviewed() {
  change(checks()[0], true);
  change(checks()[1], true);
  change(checks().at(-1) as Element, true);
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.locale = "en";
  activeWatchCount = 4;
  collectionId = "lcol_a";
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("window", { location: { reload: h.reload } });
});
afterEach(() => vi.unstubAllGlobals());
it.each(["en", "ru"])(
  "freezes membership revision and exact watch enrollment after a lost response in %s",
  async (locale) => {
    h.locale = locale;
    const copy = resourceReleaseWatchesCopy(locale as "en" | "ru");
    expect(checks()).toHaveLength(3);
    await click(copy.applyEnroll);
    expect(h.fetch).not.toHaveBeenCalled();
    reviewed();
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await click(copy.applyEnroll);
    const init = h.fetch.mock.calls[0][1] as RequestInit;
    expect(h.fetch.mock.calls[0][0]).toBe("/api/library/collections/lcol_a/watches");
    expect(JSON.parse(String(init.body))).toEqual({
      expectedCollectionRevision: 3,
      items: [
        { productId: "prd_a", expectedRevision: 0 },
        { productId: "prd_b", expectedRevision: 2 },
      ],
    });
    h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
    await click(copy.retrySame);
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);
it("bounds checkbox choices by the remaining account-wide quota", () => {
  activeWatchCount = 99;
  change(checks()[0], true);
  expect(checks()[1].props.disabled).toBe(true);
  expect(checks()).toHaveLength(3);
});
it("requires reload when collection membership changed", async () => {
  reviewed();
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "RELEASE_WATCH_COLLECTION_CONFLICT" }),
  });
  await click("Enable selected watches");
  expect(
    render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  await click("Reload current state");
  expect(h.reload).toHaveBeenCalledOnce();
});

it("retains the reviewed collection endpoint when props change before a retry", async () => {
  reviewed();
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await click("Enable selected watches");
  const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
  collectionId = "lcol_other";
  h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
  await click("Retry the same request");
  expect(h.fetch.mock.calls[1][0]).toBe(url);
  expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
  expect(h.refresh).toHaveBeenCalledOnce();
});
