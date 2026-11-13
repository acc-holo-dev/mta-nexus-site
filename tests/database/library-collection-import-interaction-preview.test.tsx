import { expect, it, vi } from "vitest";
import {
  createLibraryCollectionImportInteractionHelpers,
  mockReactHooks,
} from "../helpers/library-collection-import-interaction-harness";

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  fetch: vi.fn(),
  cleanup: null as (() => void) | null,
}));
vi.mock("react", (original) => mockReactHooks(harness)(original));

import { LibraryCollectionBatchForm } from "../../site/src/components/library-collection-batch";
import { LibraryCollectionImport } from "../../site/src/components/library-collection-import";
import { libraryCollectionManifestsCopy } from "../../site/src/lib/library-collection-manifests-i18n";

const { state, collection, manifest, response, render, textarea, inspect, child } =
  createLibraryCollectionImportInteractionHelpers(
    harness,
    LibraryCollectionImport,
    LibraryCollectionBatchForm,
  );

it.each(["en", "ru"] as const)(
  "reviews a portable file and offers only eligible references within capacity in %s",
  async (language) => {
    state.locale = language;
    textarea();
    harness.fetch.mockResolvedValueOnce(response());
    await inspect();
    expect(harness.fetch).toHaveBeenCalledOnce();
    const [url, init] = harness.fetch.mock.calls[0] as [string, RequestInit];
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
  harness.fetch.mockResolvedValueOnce(response());
  await inspect();
  expect(child()).toBeDefined();
  textarea(JSON.stringify({ ...manifest(), productIds: [] }));
  expect(child()).toBeUndefined();
});
