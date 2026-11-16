import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type LibraryCollectionImportHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  cleanup: (() => void) | null;
};

type Collection = {
  id: string;
  name: string;
  status: "active";
  revision: number;
};

type PreviewItem = {
  productId: string;
  title: string | null;
  available: boolean;
  inCollection: boolean;
  canAdd: boolean;
  inManifest?: boolean;
  canRemove?: boolean;
};

type Preview = {
  schemaVersion: number;
  generatedAt: string;
  collection: Collection;
  itemCount: number;
  itemLimit: number;
  batchLimit: number;
  items: PreviewItem[];
};

type LibraryCollectionImportComponent = (props: {
  collection: Collection;
  locale: "en" | "ru";
  reconcile: boolean;
}) => ReactNode;

/** Used only for element-type identity; never[] keeps real form assignable. */
type BatchFormComponent = (...args: never[]) => ReactNode;

const collection: Collection = {
  id: "lcol_a",
  name: "Destination",
  status: "active",
  revision: 7,
};

/** Shared react mock factory for import interaction suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: LibraryCollectionImportHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useEffect: (effect: () => () => void) => {
      harness.cleanup ??= effect();
    },
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = initial;
      return [
        harness.slots[i],
        (v: unknown) => {
          harness.slots[i] =
            typeof v === "function" ? (v as (p: unknown) => unknown)(harness.slots[i]) : v;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = { current: initial };
      return harness.slots[i];
    },
  });
}

export function createLibraryCollectionImportInteractionHelpers(
  harness: LibraryCollectionImportHarness,
  LibraryCollectionImport: LibraryCollectionImportComponent,
  LibraryCollectionBatchForm: BatchFormComponent,
) {
  const state = {
    locale: "en" as "en" | "ru",
    reconcile: false,
  };

  function manifest() {
    return {
      schemaVersion: 1,
      generatedAt: "2026-10-12T00:00:00.000Z",
      collection: { ...collection, id: "lcol_source" },
      productIds: ["prd_a", "prd_b", "prd_c"],
    };
  }

  function preview(): Preview {
    return {
      schemaVersion: 1,
      generatedAt: "2026-10-12T00:00:01.000Z",
      collection,
      itemCount: 199,
      itemLimit: 200,
      batchLimit: 20,
      items: [
        {
          productId: "prd_a",
          title: "Available",
          available: true,
          inCollection: false,
          canAdd: true,
        },
        {
          productId: "prd_b",
          title: null,
          available: false,
          inCollection: true,
          canAdd: false,
        },
        {
          productId: "prd_c",
          title: null,
          available: false,
          inCollection: false,
          canAdd: false,
        },
      ],
    };
  }

  function response(value: Preview = preview()) {
    return { ok: true, json: async () => value };
  }

  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      LibraryCollectionImport({
        collection,
        locale: state.locale,
        reconcile: state.reconcile,
      }),
    );
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

  function child() {
    return render().find((n) => n.type === LibraryCollectionBatchForm);
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanup = null;
    vi.clearAllMocks();
    vi.stubGlobal("fetch", harness.fetch);
    state.locale = "en";
    state.reconcile = false;
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    state,
    collection,
    manifest,
    preview,
    response,
    render,
    textarea,
    inspect,
    readFile,
    child,
  };
}
