import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
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
import { LibraryCollectionItemCopyForm } from "../apps/web/src/components/library-collection-item-copy";
import { libraryCollectionsCopy } from "../apps/web/src/lib/library-collections-i18n";
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const e = node as Element;
  return [e, ...nodes(e.props.children as ReactNode)];
}
let source = {
  id: "lcol_source",
  name: "Archive",
  status: "archived" as "active" | "archived",
  revision: 4,
};
let destinations = [
  {
    id: "lcol_target",
    name: "Target",
    status: "active" as const,
    revision: 2,
    itemCount: 199,
    presentProductIds: ["prd_a"],
  },
];
const items = [
  { productId: "prd_b", title: "Second" },
  { productId: "prd_a", title: null },
];
let locale: "en" | "ru" = "en";
let move = false;
function firstDestination() {
  const value = destinations[0];
  if (!value) throw new Error("Missing target");
  return value;
}
function render() {
  h.cursor = 0;
  return nodes(LibraryCollectionItemCopyForm({ source, destinations, items, locale, move }));
}
function change(node: Element, value: unknown) {
  (node.props.onChange as (e: unknown) => void)({ target: value });
}
function choose() {
  const node = render().find((n) => n.type === "select");
  if (!node) throw Error("Missing destination");
  change(node, { value: "lcol_target" });
}
function check(index: number, checked = true) {
  const node = render().filter((n) => n.type === "input")[index];
  if (!node) throw Error("Missing checkbox");
  change(node, { checked });
}
function submit(tree = render()) {
  const form = tree.find((n) => n.type === "form");
  if (!form) throw Error("Missing form");
  return (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
}
function reviewed() {
  choose();
  check(0);
  check(1);
  check(2);
}
function success(init: RequestInit, extra = {}) {
  const command = JSON.parse(String(init.body));
  return {
    ok: true,
    status: 200,
    json: async () => ({
      replayed: false,
      receipt: {
        id: "lcr_a",
        requestId: command.requestId,
        command,
        collection: { id: "lcol_target", name: "Target", status: "active", revision: 3 },
        ...(command.action === "move-items"
          ? {
              sourceCollection: {
                id: command.sourceCollectionId,
                revision: command.expectedSourceRevision + 1,
              },
            }
          : {}),
        createdAt: "2026-10-12T00:00:00.000Z",
        ...extra,
      },
    }),
  };
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.cleanup = null;
  locale = "en";
  move = false;
  source = { id: "lcol_source", name: "Archive", status: "archived", revision: 4 };
  destinations = [
    {
      id: "lcol_target",
      name: "Target",
      status: "active",
      revision: 2,
      itemCount: 199,
      presentProductIds: ["prd_a"],
    },
  ];
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
  vi.stubGlobal("window", { location: { reload: h.reload } });
});
afterEach(() => vi.unstubAllGlobals());
it.each(["en", "ru"] as const)(
  "requires reviewed selections and retains both collection revisions after response loss in %s",
  async (value) => {
    locale = value;
    choose();
    check(0);
    check(1);
    await submit();
    expect(h.fetch).not.toHaveBeenCalled();
    check(2);
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await submit();
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/collections/lcol_target");
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: "copy-items",
      sourceCollectionId: "lcol_source",
      expectedSourceRevision: 4,
      expectedRevision: 2,
      productIds: ["prd_a", "prd_b"],
    });
    source = { ...source, id: "lcol_other_source", revision: 9 };
    destinations = [{ ...firstDestination(), id: "lcol_other_target", revision: 9 }];
    h.fetch.mockResolvedValueOnce(success(init));
    await submit();
    expect(h.fetch.mock.calls[1][0]).toBe(url);
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(
      render().some(
        (n) =>
          n.props.role === "status" && n.props.children === libraryCollectionsCopy(locale).saved,
      ),
    ).toBe(true);
    expect(render().find((n) => n.type === "a")?.props.href).toBe(
      "/workspace/library/collections/lcol_target",
    );
  },
);
it("counts only missing destination references against its capacity", async () => {
  reviewed();
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => success(init));
  await submit();
  expect(h.fetch).toHaveBeenCalledOnce();
  h.slots = [];
  destinations = [{ ...firstDestination(), presentProductIds: [] }];
  reviewed();
  await submit();
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(
    render().some(
      (n) => n.props.role === "alert" && n.props.children === libraryCollectionsCopy("en").quota,
    ),
  ).toBe(true);
});
it("clears acknowledgement whenever destination or selected references change", async () => {
  reviewed();
  check(0, false);
  await submit();
  expect(h.fetch).not.toHaveBeenCalled();
});
it("does not accept a receipt with altered source proof", async () => {
  reviewed();
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(init, { command: { ...JSON.parse(String(init.body)), expectedSourceRevision: 9 } }),
  );
  await submit();
  expect(render().some((n) => n.props.role === "status")).toBe(false);
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});
it("blocks stale handlers after a conflict and requires reload", async () => {
  reviewed();
  const tree = render();
  h.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({ code: "COLLECTION_CONFLICT" }),
  });
  await submit(tree);
  await submit(tree);
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(
    render()
      .filter((n) => n.type === "button")
      .every((n) => n.props.type === "button"),
  ).toBe(true);
  const button = render().find((n) => n.type === "button");
  if (!button) throw new Error("Missing reload action");
  (button.props.onClick as () => void)();
  expect(h.reload).toHaveBeenCalledOnce();
});
it("coalesces duplicate submissions and ignores a successful response after unmount", async () => {
  reviewed();
  let resolve: (v: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const tree = render(),
    pending = submit(tree);
  await submit(tree);
  expect(h.fetch).toHaveBeenCalledOnce();
  const init = h.fetch.mock.calls[0][1] as RequestInit;
  h.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  resolve(success(init));
  await pending;
  expect(render().some((n) => n.props.role === "status")).toBe(false);
});

it.each(["en", "ru"] as const)(
  "moves from an active source with an exact UUID retry and confirms both successors in %s",
  async (value) => {
    locale = value;
    move = true;
    source = { ...source, status: "active" };
    reviewed();
    h.fetch.mockRejectedValueOnce(new Error("lost"));
    await submit();
    const init = h.fetch.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: "move-items",
      expectedSourceRevision: 4,
      expectedRevision: 2,
      productIds: ["prd_a", "prd_b"],
    });
    h.fetch.mockResolvedValueOnce(success(init));
    await submit();
    expect(h.fetch.mock.calls[1][1].body).toBe(init.body);
    expect(render().some((n) => n.props.role === "status")).toBe(true);
    expect(
      render()
        .filter((n) => n.type === "a")
        .map((n) => n.props.href),
    ).toEqual([
      "/workspace/library/collections/lcol_source",
      "/workspace/library/collections/lcol_target",
    ]);
  },
);
it("does not offer move submission for an archived source", () => {
  move = true;
  expect(
    render().some((n) => n.props.children === libraryCollectionsCopy("en").moveSourceUnavailable),
  ).toBe(true);
  expect(render().some((n) => n.type === "form")).toBe(false);
  expect(h.fetch).not.toHaveBeenCalled();
});
it("does not confirm a destination-only move acknowledgement", async () => {
  move = true;
  source = { ...source, status: "active" };
  reviewed();
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(init, { sourceCollection: undefined }),
  );
  await submit();
  expect(render().some((n) => n.props.role === "status")).toBe(false);
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});
