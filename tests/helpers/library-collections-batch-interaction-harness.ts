import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type LibraryCollectionsBatchHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  cleanup: (() => void) | null;
};

type LibraryCollectionBatchFormComponent = (props: {
  locale: "ru" | "en";
  collection: {
    id: string;
    name: string;
    status: "active" | "archived";
    revision: number;
  };
  action: "add-many" | "remove-many";
  items: { productId: string; title: string | null; hasAccess: boolean }[];
  maxSelection?: number;
  returnHref?: string;
  onFreeze?: () => void;
}) => ReactNode;

const collection = { id: "lcol_a", name: "Core", status: "active" as const, revision: 4 };
const items = [
  { productId: "prd_b", title: "Second", hasAccess: true },
  { productId: "prd_a", title: null, hasAccess: false },
];

/** Shared react mock factory for library-collections batch suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: LibraryCollectionsBatchHarness) {
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

export function createLibraryCollectionsBatchInteractionHelpers(
  harness: LibraryCollectionsBatchHarness,
  LibraryCollectionBatchForm: LibraryCollectionBatchFormComponent,
) {
  function render(
    action: "add-many" | "remove-many" = "remove-many",
    entries = items,
    overrides: Partial<Parameters<LibraryCollectionBatchFormComponent>[0]> = {},
  ) {
    harness.cursor = 0;
    return flattenReactTestTree(
      LibraryCollectionBatchForm({
        locale: "en",
        collection,
        action,
        items: entries,
        ...overrides,
      }),
    );
  }

  function check(
    index: number,
    checked = true,
    action: "add-many" | "remove-many" = "remove-many",
    entries = items,
  ) {
    const input = render(action, entries).filter((n) => n.type === "input")[index];
    if (!input) throw new Error("Missing checkbox");
    (input.props.onChange as (e: unknown) => void)({ target: { checked } });
  }

  function submit(tree: FlatTestElement[] = render()) {
    const form = tree.find((n) => n.type === "form");
    if (!form) throw new Error("Missing form");
    return (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function success(command: unknown, snapshot = { ...collection, revision: 5 }) {
    return {
      ok: true,
      json: async () => ({
        replayed: false,
        receipt: {
          id: "lcr_a",
          requestId: (command as { requestId: string }).requestId,
          command,
          collection: snapshot,
          createdAt: "2026-10-11T00:00:00.000Z",
        },
      }),
    };
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanup = null;
    vi.clearAllMocks();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    collection,
    items,
    render,
    check,
    submit,
    success,
  };
}
