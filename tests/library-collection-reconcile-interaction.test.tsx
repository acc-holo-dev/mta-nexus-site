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

import { LibraryCollectionReconcileForm } from "../apps/web/src/components/library-collection-reconcile";
import type { LibraryCollectionReconcilePreview } from "@nexus/domain";
import { libraryCollectionManifestsCopy } from "../apps/web/src/lib/library-collection-manifests-i18n";
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const e = node as Element;
  return [e, ...nodes(e.props.children as ReactNode)];
}
const date = "2026-10-13T00:00:00.000Z",
  collection = { id: "lcol_a", name: "Reviewed", status: "active" as const, revision: 7 },
  freeze = vi.fn();
const fixture = (): LibraryCollectionReconcilePreview => ({
  schemaVersion: 1,
  generatedAt: date,
  collection,
  itemCount: 200,
  itemLimit: 200,
  batchLimit: 20,
  items: [
    {
      productId: "prd_new",
      title: "New",
      available: true,
      inCollection: false,
      inManifest: true,
      canAdd: true,
      canRemove: false,
    },
    {
      productId: "prd_old",
      title: null,
      available: false,
      inCollection: true,
      inManifest: false,
      canAdd: false,
      canRemove: true,
    },
  ],
});
let report = fixture(),
  locale: "ru" | "en" = "en";
function render() {
  h.cursor = 0;
  return nodes(
    LibraryCollectionReconcileForm({
      preview: report,
      locale,
      onFreeze: freeze,
      returnHref: "/workspace/library/collections/receipts/lcr_original",
    }),
  );
}
function check(i: number, checked = true) {
  const input = render().filter((n) => n.type === "input")[i];
  if (!input) throw Error("Missing choice");
  (input.props.onChange as (e: unknown) => void)({ target: { checked } });
}
function submit(tree = render()) {
  const form = tree.find((n) => n.type === "form");
  if (!form) throw Error("Missing form");
  return (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
}
function success(init: RequestInit) {
  const command = JSON.parse(String(init.body));
  return {
    ok: true,
    json: async () => ({
      replayed: false,
      receipt: {
        id: "lcr_reconcile",
        requestId: command.requestId,
        command,
        collection: { ...collection, revision: 8 },
        createdAt: date,
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
  vi.stubGlobal("fetch", h.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it.each(["en", "ru"] as const)(
  "reviews a full-collection swap and retains exact retry/receipt proof in %s",
  async (lang) => {
    locale = lang;
    check(0);
    check(2);
    await submit();
    expect(h.fetch).not.toHaveBeenCalled();
    check(1);
    await submit();
    expect(h.fetch).not.toHaveBeenCalled();
    check(2);
    h.fetch.mockRejectedValueOnce(Error("uncertain"));
    await submit();
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/collections/lcol_a");
    expect(JSON.parse(String(init.body))).toMatchObject({
      action: "reconcile-items",
      expectedRevision: 7,
      addProductIds: ["prd_new"],
      removeProductIds: ["prd_old"],
    });
    expect(freeze).toHaveBeenCalledOnce();
    report = {
      ...fixture(),
      collection: { ...collection, id: "lcol_other", status: "archived", revision: 9 },
      itemCount: 0,
      items: [],
    };
    h.fetch.mockResolvedValueOnce(success(init));
    await submit();
    expect(h.fetch.mock.calls[1]?.[0]).toBe(url);
    expect(h.fetch.mock.calls[1]?.[1].body).toBe(init.body);
    expect(freeze).toHaveBeenCalledOnce();
    expect(h.refresh).toHaveBeenCalledOnce();
    expect(
      render().some((n) => n.props.href === "/workspace/library/collections/receipts/lcr_original"),
    ).toBe(true);
    expect(
      render().some(
        (n) => n.props.href === "/workspace/library/collections/receipts/lcr_reconcile",
      ),
    ).toBe(true);
    expect(
      render().some((n) => n.props.href === "/workspace/library/collections/lcol_a/history"),
    ).toBe(true);
  },
);
it("requires renewed review after collection or choice snapshot changes", async () => {
  check(0);
  check(1);
  check(2);
  report = { ...report, collection: { ...collection, revision: 8 } };
  expect(render().filter((n) => n.type === "input")[2]?.props.checked).toBe(false);
  await submit();
  expect(h.fetch).not.toHaveBeenCalled();
});
it.each([400, 401, 403, 404, 409, 413, 415])(
  "blocks stale mutation handlers after definitive status %s",
  async (status) => {
    check(1);
    check(2);
    const tree = render();
    h.fetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ code: "COLLECTION_CONFLICT" }),
    });
    await submit(tree);
    await submit(tree);
    expect(h.fetch).toHaveBeenCalledOnce();
    expect(render().find((n) => n.type === "button")?.props.disabled).toBe(true);
  },
);
it("aborts on unmount and ignores late confirmations", async () => {
  check(1);
  check(2);
  let finish: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = render(),
    running = submit(tree),
    init = h.fetch.mock.calls[0]?.[1] as RequestInit;
  h.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  finish(success(init));
  await running;
  await submit(tree);
  expect(h.refresh).not.toHaveBeenCalled();
  expect(h.fetch).toHaveBeenCalledOnce();
});
it("rejects mismatched addition/removal acknowledgements and retries only the original body", async () => {
  check(1);
  check(2);
  h.fetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
    const body = await success(init).json();
    body.receipt.command.removeProductIds = ["prd_other"];
    return { ok: true, json: async () => body };
  });
  await submit();
  expect(h.refresh).not.toHaveBeenCalled();
  const init = h.fetch.mock.calls[0]?.[1] as RequestInit;
  h.fetch.mockResolvedValueOnce(success(init));
  await submit();
  expect(h.refresh).toHaveBeenCalledOnce();
});
it("caps combined selected changes at twenty and makes archived previews read only", () => {
  report = {
    ...fixture(),
    itemCount: 0,
    items: Array.from(
      { length: 21 },
      (_, i) =>
        ({
          ...fixture().items[0],
          productId: `prd_${i}`,
        }) as LibraryCollectionReconcilePreview["items"][number],
    ),
  };
  for (let i = 0; i < 20; i++) check(i);
  expect(render().filter((n) => n.type === "input")[20]?.props.disabled).toBe(true);
  check(0, false);
  expect(render().filter((n) => n.type === "input")[20]?.props.disabled).toBe(false);
  report = { ...report, collection: { ...collection, status: "archived" }, items: [] };
  expect(
    render().some((n) => n.props.children === libraryCollectionManifestsCopy("en").noChanges),
  ).toBe(true);
});
