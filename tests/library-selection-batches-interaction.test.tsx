import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
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
import { LibrarySelectionBatchControls } from "../apps/web/src/components/library-selection-batch-controls";
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
  { productId: "prd_a", title: "Core", downloadable: true, hasAccess: true },
  { productId: "prd_b", title: "Unavailable pin", downloadable: false, hasAccess: true },
];
function render() {
  h.cursor = 0;
  return nodes(LibrarySelectionBatchControls({ collectionId: "lcol_a", locale: "en", items }));
}
function checks() {
  return render().filter((n) => n.type === "input" && n.props.type === "checkbox");
}
function change(e: Element, checked: boolean) {
  (e.props.onChange as (v: unknown) => void)({ target: { checked } });
}
async function click(label: string) {
  const button = render().find((n) => n.type === "button" && n.props.children === label);
  if (!button) throw new Error(`Missing button ${label}`);
  (button.props.onClick as () => void)();
  await new Promise((r) => setTimeout(r, 0));
}
const preview = {
  collection: { id: "lcol_a", name: "Core", status: "active", revision: 4 },
  choice: { mode: "fixed", productIds: ["prd_a"] },
  previewDigest: "a".repeat(64),
  changedCount: 1,
  items: [
    {
      productId: "prd_a",
      title: "Core",
      version: "1",
      targetBuildId: "bld_a",
      previous: { mode: "latest", revision: 0, buildId: null },
      next: { mode: "fixed", revision: 1, buildId: "bld_a" },
    },
  ],
};
async function reviewed() {
  change(checks()[0], true);
  h.fetch.mockResolvedValueOnce({ ok: true, json: async () => preview });
  await click("Review changes");
}
function response(command: unknown) {
  return {
    ok: true,
    json: async () => ({
      replayed: false,
      receipt: {
        id: "lsbr_a",
        requestId: (command as { requestId: string }).requestId,
        command,
        snapshot: {
          collectionId: "lcol_a",
          collectionRevision: 4,
          mode: "fixed",
          items: preview.items.map(({ productId, previous, next }) => ({
            productId,
            previous,
            next,
          })),
        },
        createdAt: "2026-10-12T00:00:00.000Z",
      },
    }),
  };
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("requires selecting resources and explicit acknowledgement before applying", async () => {
  await click("Review changes");
  expect(h.fetch).not.toHaveBeenCalled();
  await reviewed();
  await click("Apply batch");
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(h.refresh).not.toHaveBeenCalled();
});
it("retries exactly the frozen UUID, digest and membership after a lost response", async () => {
  await reviewed();
  const confirmation = checks().at(-1);
  if (!confirmation) throw new Error("Missing confirmation");
  change(confirmation, true);
  h.fetch.mockRejectedValueOnce(new Error("lost"));
  await click("Apply batch");
  const init = h.fetch.mock.calls[1][1] as RequestInit,
    command = JSON.parse(String(init.body));
  expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
  h.fetch.mockResolvedValueOnce(response(command));
  await click("Retry the same request");
  expect(h.fetch.mock.calls[2][1].body).toBe(init.body);
  expect(h.refresh).toHaveBeenCalledOnce();
});
it("does not acknowledge foreign receipt snapshots", async () => {
  await reviewed();
  const confirmation = checks().at(-1);
  if (!confirmation) throw new Error("Missing confirmation");
  change(confirmation, true);
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const r = response(JSON.parse(String(init.body)));
    const body = await r.json();
    body.receipt.snapshot.collectionId = "lcol_b";
    return { ok: true, json: async () => body };
  });
  await click("Apply batch");
  expect(h.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});
it("clears a preview when the choice changes and allows recovery from withdrawn pins in latest mode", async () => {
  await reviewed();
  const radio = render().find((n) => n.type === "input" && n.props.value === "latest");
  if (!radio) throw new Error("Missing latest mode");
  (radio.props.onChange as () => void)();
  expect(render().some((n) => n.type === "button" && n.props.children === "Apply batch")).toBe(
    false,
  );
  expect(checks()[1].props.disabled).toBe(false);
});
it("coalesces duplicate preview clicks while a request is pending", async () => {
  change(checks()[0], true);
  let resolve: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  await click("Review changes");
  await click("Processing…");
  expect(h.fetch).toHaveBeenCalledOnce();
  resolve({ ok: true, json: async () => preview });
  await new Promise((r) => setTimeout(r, 0));
});
