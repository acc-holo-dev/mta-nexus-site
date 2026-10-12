import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const h = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
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
import { LibraryMembershipBatchForm } from "../apps/web/src/components/library-membership-batch";
import type { LibraryResourceCollections } from "@nexus/domain";
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const e = node as Element;
  return [e, ...nodes(e.props.children as ReactNode)];
}
const fixture = (): LibraryResourceCollections => ({
  schemaVersion: 1,
  generatedAt: "2026-10-12T00:00:00.000Z",
  resource: { productId: "prd_a", title: null, available: false, canAdd: true },
  collections: [
    { id: "lcol_a", name: "Core", status: "active", revision: 2, itemCount: 1, inCollection: true },
    {
      id: "lcol_b",
      name: "Empty",
      status: "active",
      revision: 4,
      itemCount: 0,
      inCollection: false,
    },
  ],
  collectionLimit: 30,
  itemLimit: 200,
});
let report = fixture(),
  locale: "en" | "ru" = "en";
function render() {
  h.cursor = 0;
  return nodes(LibraryMembershipBatchForm({ report, locale }));
}
function check(index: number, value: boolean) {
  const input = render().filter((n) => n.type === "input")[index];
  if (!input) throw Error("Missing checkbox");
  (input.props.onChange as (e: unknown) => void)({ target: { checked: value } });
}
function submit(tree = render()) {
  const form = tree.find((n) => n.type === "form");
  if (!form) throw Error("Missing form");
  return (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
}
function reviewed() {
  check(0, false);
  check(1, true);
  check(2, true);
}
function success(init: RequestInit, original = fixture(), partial = false) {
  const command = JSON.parse(String(init.body));
  const children = command.changes.map(
    (
      change: { collectionId: string; expectedRevision: number; inCollection: boolean },
      index: number,
    ) => {
      const collection = original.collections.find((c) => c.id === change.collectionId);
      if (!collection) throw Error("Missing fixture collection");
      const requestId = `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`;
      return {
        id: `lcr_${index}`,
        requestId,
        command: {
          requestId,
          action: change.inCollection ? "add" : "remove",
          expectedRevision: change.expectedRevision,
          productId: original.resource.productId,
        },
        collection: {
          id: collection.id,
          name: collection.name,
          status: "active",
          revision: change.expectedRevision + 1,
        },
        createdAt: "2026-10-12T00:00:00.000Z",
      };
    },
  );
  return {
    ok: true,
    status: 200,
    json: async () => ({
      replayed: false,
      receipt: {
        id: "lmb_a",
        requestId: command.requestId,
        productId: original.resource.productId,
        command,
        children: partial ? children.slice(1) : children,
        createdAt: "2026-10-12T00:00:01.000Z",
      },
    }),
  };
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.cleanup = null;
  report = fixture();
  locale = "en";
  vi.clearAllMocks();
  h.fetch.mockReset();
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it.each(["en", "ru"] as const)(
  "reviews a mixed membership group and freezes every %s retry proof",
  async (value) => {
    locale = value;
    check(0, false);
    check(1, true);
    await submit();
    expect(h.fetch).not.toHaveBeenCalled();
    check(2, true);
    h.fetch.mockRejectedValueOnce(Error("lost response"));
    await submit();
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/prd_a/collections");
    expect(JSON.parse(String(init.body))).toMatchObject({
      changes: [
        { collectionId: "lcol_a", expectedRevision: 2, wasInCollection: true, inCollection: false },
        { collectionId: "lcol_b", expectedRevision: 4, wasInCollection: false, inCollection: true },
      ],
    });
    report = {
      ...fixture(),
      resource: { ...fixture().resource, productId: "prd_other" },
      collections: [],
    };
    h.fetch.mockResolvedValueOnce(success(init));
    await submit();
    expect(h.fetch.mock.calls[1]?.[0]).toBe(url);
    expect(h.fetch.mock.calls[1]?.[1].body).toBe(init.body);
    expect(h.refresh).toHaveBeenCalledOnce();
    expect(render().some((n) => n.props.role === "status")).toBe(true);
  },
);
it("clears review when a collection revision changes before the first request", async () => {
  reviewed();
  report = {
    ...report,
    collections: report.collections.map((c) => ({ ...c, revision: c.revision + 1 })),
  };
  await submit();
  expect(h.fetch).not.toHaveBeenCalled();
});
it("refuses incomplete confirmation and retains an identical retry", async () => {
  reviewed();
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) =>
    success(init, fixture(), true),
  );
  await submit();
  expect(h.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
  const init = h.fetch.mock.calls[0]?.[1] as RequestInit;
  h.fetch.mockResolvedValueOnce(success(init));
  await submit();
  expect(h.fetch.mock.calls[1]?.[1].body).toBe(init.body);
});
it("blocks stale handlers after a conflict or confirmed result", async () => {
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
  expect(render().find((n) => n.type === "button")?.props.disabled).toBe(true);
});
it("aborts on unmount and ignores late success", async () => {
  reviewed();
  let resolve: (v: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const tree = render(),
    pending = submit(tree),
    init = h.fetch.mock.calls[0]?.[1] as RequestInit;
  h.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  resolve(success(init));
  await pending;
  await submit(tree);
  expect(h.refresh).not.toHaveBeenCalled();
  expect(h.fetch).toHaveBeenCalledOnce();
});
it("permits lost-access removals and keeps the final orphan-removal receipt visible", async () => {
  report.resource.canAdd = false;
  check(0, false);
  check(2, true);
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => success(init));
  await submit();
  expect(h.refresh).not.toHaveBeenCalled();
  expect(render().some((n) => n.props.role === "status")).toBe(true);
});
it("does not offer additions into full or archived collections or without current access", () => {
  report.resource.canAdd = false;
  expect(render().filter((n) => n.type === "input")[1]?.props.disabled).toBe(true);
  report = fixture();
  report.collections = report.collections.map((c, i) => (i === 1 ? { ...c, itemCount: 200 } : c));
  expect(render().filter((n) => n.type === "input")[1]?.props.disabled).toBe(true);
  report.collections = report.collections.map((c, i) =>
    i === 0 ? { ...c, status: "archived" } : c,
  );
  expect(render().filter((n) => n.type === "input")[0]?.props.disabled).toBe(true);
});

it("caps changed collections at twenty while allowing a selected change to be undone", () => {
  report.collections = Array.from({ length: 30 }, (_, i) => ({
    id: `lcol_${i}`,
    name: `Collection ${i}`,
    status: "active",
    revision: 1,
    itemCount: 0,
    inCollection: false,
  }));
  for (let i = 0; i < 20; i++) check(i, true);
  const inputs = render().filter((n) => n.type === "input");
  expect(inputs[20]?.props.disabled).toBe(true);
  expect(inputs[0]?.props.disabled).toBe(false);
  check(0, false);
  expect(render().filter((n) => n.type === "input")[20]?.props.disabled).toBe(false);
});
it("never repeats a confirmed group through a stale submission handler", async () => {
  reviewed();
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => success(init));
  const tree = render();
  await submit(tree);
  await submit(tree);
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(h.refresh).toHaveBeenCalledOnce();
});
