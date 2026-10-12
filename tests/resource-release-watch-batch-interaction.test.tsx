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
  return [e, ...nodes(e.props.children as ReactNode)];
}
const items = [
  { productId: "prd_b", enabled: true, revision: 3, title: null },
  { productId: "prd_a", enabled: true, revision: 1, title: "Core" },
];
function render() {
  h.cursor = 0;
  return nodes(ResourceReleaseWatchBatchControls({ items, locale: h.locale as "en" | "ru" }));
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
      enabled: false,
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
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("window", { location: { reload: h.reload } });
});
afterEach(() => vi.unstubAllGlobals());
it.each(["en", "ru"])(
  "requires review and retries exactly the frozen sorted batch in %s",
  async (locale) => {
    h.locale = locale;
    const copy = resourceReleaseWatchesCopy(locale as "en" | "ru");
    await click(copy.applyBatch);
    expect(h.fetch).not.toHaveBeenCalled();
    reviewed();
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await click(copy.applyBatch);
    const init = h.fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body)).items).toEqual([
      { productId: "prd_a", expectedRevision: 1 },
      { productId: "prd_b", expectedRevision: 3 },
    ]);
    expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
    h.fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ack(init) });
    await click(copy.retrySame);
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
  },
);
it("does not confirm partial or foreign acknowledgements", async () => {
  reviewed();
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const body = ack(init);
    body.items[0].productId = "prd_foreign";
    return { ok: true, status: 200, json: async () => body };
  });
  await click("Stop selected watches");
  expect(h.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});
it("requires reload after a revision conflict and clears acknowledgement when selection changes", async () => {
  reviewed();
  change(checks()[0], false);
  expect(button("Stop selected watches").props.disabled).toBe(true);
  change(checks().at(-1) as Element, true);
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "RELEASE_WATCH_BATCH_CONFLICT" }),
  });
  await click("Stop selected watches");
  expect(
    render().some((n) => n.type === "button" && n.props.children === "Retry the same request"),
  ).toBe(false);
  await click("Reload current state");
  expect(h.reload).toHaveBeenCalledOnce();
});
it("coalesces stale duplicate click handlers while a request is in flight", async () => {
  reviewed();
  let resolve: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const action = button("Stop selected watches").props.onClick as () => void;
  action();
  action();
  expect(h.fetch).toHaveBeenCalledOnce();
  const init = h.fetch.mock.calls[0][1] as RequestInit;
  resolve({ ok: true, status: 200, json: async () => ack(init) });
  await new Promise((r) => setTimeout(r, 0));
  expect(h.refresh).toHaveBeenCalledOnce();
});
