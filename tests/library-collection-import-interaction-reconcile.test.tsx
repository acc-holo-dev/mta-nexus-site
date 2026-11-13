import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionImportInteractionHelpers,
  mockReactHooks,
} from "./helpers/library-collection-import-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { LibraryCollectionBatchForm } from "../site/src/components/library-collection-batch";
import { LibraryCollectionImport } from "../site/src/components/library-collection-import";
import { LibraryCollectionReconcileForm } from "../site/src/components/library-collection-reconcile";

const { state, preview, render, textarea, inspect, child } =
  createLibraryCollectionImportInteractionHelpers(
    harness,
    LibraryCollectionImport,
    LibraryCollectionBatchForm,
  );

it("binds reconciliation preview to exact file IDs while retaining extra own removable references", async () => {
  state.reconcile = true;
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
  harness.fetch.mockResolvedValueOnce({ ok: true, json: async () => result });
  await inspect();
  expect(harness.fetch.mock.calls[0]?.[0]).toBe(
    "/api/library/collections/lcol_a/reconcile-preview",
  );
  expect(render().find((n) => n.type === LibraryCollectionReconcileForm)?.props.preview).toEqual(
    result,
  );
  expect(child()).toBeUndefined();
});

it("rejects reconciliation replies that invent extra file references or contradict current membership count", async () => {
  state.reconcile = true;
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
  harness.fetch.mockResolvedValueOnce({ ok: true, json: async () => result });
  await inspect();
  expect(render().find((n) => n.type === LibraryCollectionReconcileForm)).toBeUndefined();
  expect(render().some((n) => n.props.role === "alert")).toBe(true);
});
