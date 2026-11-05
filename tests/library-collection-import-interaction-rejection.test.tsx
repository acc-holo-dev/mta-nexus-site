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

import { LibraryCollectionBatchForm } from "../apps/web/src/components/library-collection-batch";
import { LibraryCollectionImport } from "../apps/web/src/components/library-collection-import";

const { collection, manifest, preview, response, render, textarea, inspect, child } =
  createLibraryCollectionImportInteractionHelpers(
    harness,
    LibraryCollectionImport,
    LibraryCollectionBatchForm,
  );

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
    expect(harness.fetch).not.toHaveBeenCalled();
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
    harness.fetch.mockResolvedValueOnce(response(body));
    await inspect();
    expect(child()).toBeUndefined();
    expect(render().some((n) => n.props.role === "alert")).toBe(true);
  },
);
