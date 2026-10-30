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

import { LibraryCollectionImport } from "../apps/web/src/components/library-collection-import";
import { LibraryCollectionReconcileForm } from "../apps/web/src/components/library-collection-reconcile";
import { LibraryCollectionBatchForm } from "../apps/web/src/components/library-collection-batch";
import { libraryCollectionManifestsCopy } from "../apps/web/src/lib/library-collection-manifests-i18n";
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const e = node as Element;
  const type = e.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [{ ...e, type: "button" } as Element, ...nodes(e.props.children as ReactNode)];
  }
  return [e, ...nodes(e.props.children as ReactNode)];
}
const collection = { id: "lcol_a", name: "Destination", status: "active" as const, revision: 7 };
const manifest = () => ({
  schemaVersion: 1,
  generatedAt: "2026-10-12T00:00:00.000Z",
  collection: { ...collection, id: "lcol_source" },
  productIds: ["prd_a", "prd_b", "prd_c"],
});
const preview = () => ({
  schemaVersion: 1,
  generatedAt: "2026-10-12T00:00:01.000Z",
  collection,
  itemCount: 199,
  itemLimit: 200,
  batchLimit: 20,
  items: [
    { productId: "prd_a", title: "Available", available: true, inCollection: false, canAdd: true },
    { productId: "prd_b", title: null, available: false, inCollection: true, canAdd: false },
    { productId: "prd_c", title: null, available: false, inCollection: false, canAdd: false },
  ],
});
let locale: "en" | "ru" = "en",
  reconcile = false;
function render() {
  h.cursor = 0;
  return nodes(LibraryCollectionImport({ collection, locale, reconcile }));
}
function textarea(text = JSON.stringify(manifest())) {
  const node = render().find((n) => n.type === "textarea");
  if (!node) throw Error("Missing textarea");
  (node.props.onChange as (e: unknown) => void)({ target: { value: text } });
}
function inspect(tree = render()) {
  const form = tree.find((n) => n.type === "form");
  if (!form) throw Error("Missing form");
  return (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
}
function readFile(file: { size: number; text: () => Promise<string> }) {
  const input = render().find((n) => n.type === "input");
  if (!input) throw Error("Missing file input");
  (input.props.onChange as (e: unknown) => void)({ target: { files: [file] } });
}
const response = (value = preview()) => ({ ok: true, json: async () => value });
const child = () => render().find((n) => n.type === LibraryCollectionBatchForm);
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.cleanup = null;
  vi.clearAllMocks();
  vi.stubGlobal("fetch", h.fetch);
  locale = "en";
  reconcile = false;
});
afterEach(() => vi.unstubAllGlobals());
it.each(["en", "ru"] as const)(
  "reviews a portable file and offers only eligible references within capacity in %s",
  async (language) => {
    locale = language;
    textarea();
    h.fetch.mockResolvedValueOnce(response());
    await inspect();
    expect(h.fetch).toHaveBeenCalledOnce();
    const [url, init] = h.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/library/collections/lcol_a/import-preview");
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(String(init.body))).toEqual(manifest());
    expect(child()?.props).toMatchObject({
      collection,
      action: "add-many",
      items: [{ productId: "prd_a", title: "Available", hasAccess: true }],
      maxSelection: 1,
      returnHref: "/workspace/library/collections/lcol_a/import",
    });
    expect(
      render().some((n) => n.props.children === libraryCollectionManifestsCopy(language).present),
    ).toBe(true);
  },
);
it("invalidates the preview whenever pasted content changes", async () => {
  textarea();
  h.fetch.mockResolvedValueOnce(response());
  await inspect();
  expect(child()).toBeDefined();
  textarea(JSON.stringify({ ...manifest(), productIds: [] }));
  expect(child()).toBeUndefined();
});
it.each(["invalid-json", "hidden-field", "duplicate", "large"])(
  "rejects unsafe input without preview request: %s",
  async (kind) => {
    const body =
      kind === "invalid-json"
        ? "not JSON"
        : kind === "hidden-field"
          ? JSON.stringify({ ...manifest(), ownerId: "other" })
          : kind === "duplicate"
            ? JSON.stringify({ ...manifest(), productIds: ["prd_a", "prd_a"] })
            : "ж".repeat(33000);
    textarea(body);
    await inspect();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(render().some((n) => n.props.role === "alert")).toBe(true);
  },
);
it.each(["wrong-target", "missing-item", "wrong-order", "hidden-field", "hidden-title"])(
  "refuses incomplete or unexpected server preview: %s",
  async (kind) => {
    const body = preview();
    if (kind === "wrong-target") body.collection = { ...collection, id: "lcol_foreign" };
    if (kind === "missing-item") body.items.pop();
    if (kind === "wrong-order") body.items.reverse();
    if (kind === "hidden-field") Object.assign(body, { storageKey: "PRIVATE" });
    if (kind === "hidden-title") {
      const item = body.items[1];
      if (!item) throw Error("Missing item");
      Object.assign(item, { title: "PRIVATE" });
    }
    textarea();
    h.fetch.mockResolvedValueOnce(response(body));
    await inspect();
    expect(child()).toBeUndefined();
    expect(render().some((n) => n.props.role === "alert")).toBe(true);
  },
);
it("locks parent controls and stale handlers when child mutation starts", async () => {
  textarea();
  h.fetch.mockResolvedValueOnce(response());
  await inspect();
  const node = child();
  if (!node) throw Error("Missing add form");
  const tree = render();
  (node.props.onFreeze as () => void)();
  textarea("new file");
  readFile({ size: 5, text: async () => "other" });
  await inspect(tree);
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(child()?.props.items).toEqual([
    { productId: "prd_a", title: "Available", hasAccess: true },
  ]);
  expect(render().find((n) => n.type === "fieldset")?.props.disabled).toBe(true);
});
it("aborts stale preview reads and ignores their late response after text changes", async () => {
  textarea();
  let finish: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const running = inspect();
  const init = h.fetch.mock.calls[0]?.[1] as RequestInit;
  textarea(JSON.stringify({ ...manifest(), productIds: [] }));
  expect(init.signal?.aborted).toBe(true);
  finish(response());
  await running;
  expect(child()).toBeUndefined();
});
it("aborts on unmount and never applies a late preview", async () => {
  textarea();
  let finish: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = render(),
    running = inspect(tree);
  const init = h.fetch.mock.calls[0]?.[1] as RequestInit;
  h.cleanup?.();
  expect(init.signal?.aborted).toBe(true);
  finish(response());
  await running;
  await inspect(tree);
  expect(child()).toBeUndefined();
  expect(h.fetch).toHaveBeenCalledOnce();
});
it("bounds local files and ignores stale asynchronous file reads", async () => {
  const large = vi.fn(async () => "large");
  readFile({ size: 65537, text: large });
  expect(large).not.toHaveBeenCalled();
  let finish: (text: string) => void = () => {};
  readFile({
    size: 100,
    text: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  textarea("New pasted text");
  finish(JSON.stringify(manifest()));
  await Promise.resolve();
  await Promise.resolve();
  expect(render().find((n) => n.type === "textarea")?.props.value).toBe("New pasted text");
});
it("prevents concurrent preview submissions through stale handlers", async () => {
  textarea();
  let finish: (value: unknown) => void = () => {};
  h.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const tree = render(),
    running = inspect(tree);
  await inspect(tree);
  expect(h.fetch).toHaveBeenCalledOnce();
  finish(response());
  await running;
});

it("binds reconciliation preview to exact file IDs while retaining extra own removable references", async () => {
  reconcile = true;
  textarea();
  const result = {
    ...preview(),
    itemCount: 2,
    items: [
      ...preview().items.map((item) => ({ ...item, inManifest: true, canRemove: false })),
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
  };
  h.fetch.mockResolvedValueOnce({ ok: true, json: async () => result });
  await inspect();
  expect(h.fetch.mock.calls[0]?.[0]).toBe("/api/library/collections/lcol_a/reconcile-preview");
  expect(render().find((n) => n.type === LibraryCollectionReconcileForm)?.props.preview).toEqual(
    result,
  );
  expect(child()).toBeUndefined();
});
it("rejects reconciliation replies that invent extra file references or contradict current membership count", async () => {
  reconcile = true;
  textarea();
  const result = {
    ...preview(),
    itemCount: 1,
    items: preview().items.map((item) => ({ ...item, inManifest: true, canRemove: false })),
  };
  result.items.push({
    ...result.items[0],
    productId: "prd_foreign",
    inManifest: true,
  } as (typeof result.items)[number]);
  h.fetch.mockResolvedValueOnce({ ok: true, json: async () => result });
  await inspect();
  expect(render().find((n) => n.type === LibraryCollectionReconcileForm)).toBeUndefined();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});
