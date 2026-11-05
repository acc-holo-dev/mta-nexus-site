import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type LibraryCollectionReconcileHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  cleanup: (() => void) | null;
};

type Collection = {
  id: string;
  name: string;
  status: "active" | "archived";
  revision: number;
};

type PreviewItem = {
  productId: string;
  title: string | null;
  available: boolean;
  inCollection: boolean;
  inManifest: boolean;
  canAdd: boolean;
  canRemove: boolean;
};

type Preview = {
  schemaVersion: 1;
  generatedAt: string;
  collection: Collection;
  itemCount: number;
  itemLimit: number;
  batchLimit: number;
  items: PreviewItem[];
};

type LibraryCollectionReconcileFormComponent = (props: {
  preview: Preview;
  locale: "ru" | "en";
  onFreeze: () => void;
  returnHref?: string;
}) => ReactNode;

const date = "2026-10-13T00:00:00.000Z";
const collection: Collection = {
  id: "lcol_a",
  name: "Reviewed",
  status: "active",
  revision: 7,
};

/** Shared react mock factory for reconcile interaction suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: LibraryCollectionReconcileHarness) {
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

export function createLibraryCollectionReconcileInteractionHelpers(
  harness: LibraryCollectionReconcileHarness,
  LibraryCollectionReconcileForm: LibraryCollectionReconcileFormComponent,
) {
  const freeze = vi.fn();
  const state = {
    report: fixture(),
    locale: "en" as "en" | "ru",
  };

  function fixture(): Preview {
    return {
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
    };
  }

  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      LibraryCollectionReconcileForm({
        preview: state.report,
        locale: state.locale,
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

  function submit(tree: FlatTestElement[] = render()) {
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
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanup = null;
    state.report = fixture();
    state.locale = "en";
    vi.clearAllMocks();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    collection,
    date,
    freeze,
    fixture,
    state,
    render,
    check,
    submit,
    success,
  };
}
