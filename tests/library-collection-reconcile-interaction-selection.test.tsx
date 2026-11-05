import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionReconcileInteractionHelpers,
  mockReactHooks,
} from "./helpers/library-collection-reconcile-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  refresh: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: harness.refresh }) }));

import { LibraryCollectionReconcileForm } from "../apps/web/src/components/library-collection-reconcile";
import { libraryCollectionManifestsCopy } from "../apps/web/src/lib/library-collection-manifests-i18n";

const { collection, fixture, state, render, check, submit } =
  createLibraryCollectionReconcileInteractionHelpers(harness, LibraryCollectionReconcileForm);

it("requires renewed review after collection or choice snapshot changes", async () => {
  check(0);
  check(1);
  check(2);
  state.report = { ...state.report, collection: { ...collection, revision: 8 } };
  expect(render().filter((n) => n.type === "input")[2]?.props.checked).toBe(false);
  await submit();
  expect(harness.fetch).not.toHaveBeenCalled();
});

it("caps combined selected changes at twenty and makes archived previews read only", () => {
  state.report = {
    ...fixture(),
    itemCount: 0,
    items: Array.from({ length: 21 }, (_, i) => ({
      ...fixture().items[0],
      productId: `prd_${i}`,
    })),
  };
  for (let i = 0; i < 20; i++) check(i);
  expect(render().filter((n) => n.type === "input")[20]?.props.disabled).toBe(true);
  check(0, false);
  expect(render().filter((n) => n.type === "input")[20]?.props.disabled).toBe(false);
  state.report = { ...state.report, collection: { ...collection, status: "archived" }, items: [] };
  expect(
    render().some((n) => n.props.children === libraryCollectionManifestsCopy("en").noChanges),
  ).toBe(true);
});
