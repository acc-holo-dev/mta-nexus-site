import type { ReactElement, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
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

import { LibraryCollectionRestoreControls } from "../apps/web/src/components/library-collection-restore";
import { LibraryCollectionReconcileForm } from "../apps/web/src/components/library-collection-reconcile";
import type { LibraryCollectionChangesPreview } from "@nexus/domain";
type Element = ReactElement<Record<string, unknown>>;
function nodes(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const e = node as Element;
  return [e, ...nodes(e.props.children as ReactNode)];
}
const fixture = (): LibraryCollectionChangesPreview => ({
  schemaVersion: 1,
  generatedAt: "2026-10-13T00:00:00.000Z",
  collection: { id: "lcol_a", name: "Reviewed", status: "active", revision: 7 },
  itemCount: 200,
  itemLimit: 200,
  batchLimit: 20,
  items: [
    {
      productId: "prd_old",
      title: null,
      available: false,
      inCollection: true,
      canAdd: false,
      canRemove: true,
    },
  ],
});
let report = fixture(),
  id = "lcr_original";
function child() {
  h.cursor = 0;
  return nodes(
    LibraryCollectionRestoreControls({ preview: report, receiptId: id, locale: "en" }),
  ).find((node) => node.type === LibraryCollectionReconcileForm);
}
beforeEach(() => {
  h.slots = [];
  h.cursor = 0;
  h.cleanup = null;
  report = fixture();
  id = "lcr_original";
  vi.clearAllMocks();
});
it("updates the review before submission but pins the preview and receipt return link when mutation starts", () => {
  report = { ...report, collection: { ...report.collection, revision: 8 } };
  expect(child()?.props.preview).toEqual(report);
  const node = child();
  if (!node) throw Error("Missing review");
  (node.props.onFreeze as () => void)();
  const reviewed = report;
  report = {
    ...fixture(),
    collection: { ...fixture().collection, id: "lcol_other", revision: 9 },
    items: [],
    itemCount: 0,
  };
  id = "lcr_other";
  expect(child()?.props.preview).toEqual(reviewed);
  expect(child()?.props.returnHref).toBe("/workspace/library/collections/receipts/lcr_original");
});
it("preserves a saved/uncertain review when refresh has no remaining selectable changes", () => {
  const node = child();
  if (!node) throw Error("Missing review");
  (node.props.onFreeze as () => void)();
  report = {
    ...report,
    collection: { ...report.collection, revision: 8 },
    items: report.items.map((item) => ({ ...item, inCollection: false, canRemove: false })),
  };
  const frozen = child();
  if (!frozen) throw Error("Missing frozen review");
  const preview = frozen.props.preview as LibraryCollectionChangesPreview;
  expect(preview.items[0]?.canRemove).toBe(true);
  expect(preview.collection.revision).toBe(7);
});
