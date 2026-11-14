import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

export type LibraryCollectionItemCopyHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  reload: Mock;
  cleanup: (() => void) | null;
};

export type LibraryCollectionItemCopyFormComponent = (props: {
  source: {
    id: string;
    name: string;
    status: "active" | "archived";
    revision: number;
  };
  destinations: {
    id: string;
    name: string;
    status: "active";
    revision: number;
    itemCount: number;
    presentProductIds: string[];
  }[];
  items: { productId: string; title: string | null }[];
  locale: "en" | "ru";
  move: boolean;
  initialDestinationId: string;
}) => ReactNode;

type Element = FlatTestElement;

const defaultItems = [
  { productId: "prd_b", title: "Second" },
  { productId: "prd_a", title: null },
];

type CopyFixtureState = {
  source: {
    id: string;
    name: string;
    status: "active" | "archived";
    revision: number;
  };
  destinations: {
    id: string;
    name: string;
    status: "active";
    revision: number;
    itemCount: number;
    presentProductIds: string[];
  }[];
  entries: { productId: string; title: string | null }[];
  initialDestinationId: string;
  locale: "en" | "ru";
  move: boolean;
};

/** Shared react mock factory for item-copy interaction suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: LibraryCollectionItemCopyHarness) {
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

export function createLibraryCollectionItemCopyInteractionHelpers(
  harness: LibraryCollectionItemCopyHarness,
  LibraryCollectionItemCopyForm: LibraryCollectionItemCopyFormComponent,
) {
  const state: CopyFixtureState = {
    source: { id: "lcol_source", name: "Archive", status: "archived", revision: 4 },
    destinations: [
      {
        id: "lcol_target",
        name: "Target",
        status: "active",
        revision: 2,
        itemCount: 199,
        presentProductIds: ["prd_a"],
      },
    ],
    entries: [...defaultItems],
    initialDestinationId: "",
    locale: "en",
    move: false,
  };

  function firstDestination() {
    const value = state.destinations[0];
    if (!value) throw new Error("Missing target");
    return value;
  }

  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      LibraryCollectionItemCopyForm({
        source: state.source,
        destinations: state.destinations,
        items: state.entries,
        locale: state.locale,
        move: state.move,
        initialDestinationId: state.initialDestinationId,
      }),
    );
  }

  function change(node: Element, value: unknown) {
    (node.props.onChange as (e: unknown) => void)({ target: value });
  }

  function choose() {
    const node = render().find((n) => n.type === "select");
    if (!node) throw Error("Missing destination");
    change(node, { value: "lcol_target" });
  }

  function check(index: number, checked = true) {
    const node = render().filter((n) => n.type === "input")[index];
    if (!node) throw Error("Missing checkbox");
    change(node, { checked });
  }

  function submit(tree = render()) {
    const form = tree.find((n) => n.type === "form");
    if (!form) throw Error("Missing form");
    return (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function reviewed() {
    choose();
    check(0);
    check(1);
    check(2);
  }

  function success(init: RequestInit, extra: Record<string, unknown> = {}) {
    const command = JSON.parse(String(init.body));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        replayed: false,
        receipt: {
          id: "lcr_a",
          requestId: command.requestId,
          command,
          collection: { id: "lcol_target", name: "Target", status: "active", revision: 3 },
          ...(command.action === "move-items"
            ? {
                sourceCollection: {
                  id: command.sourceCollectionId,
                  revision: command.expectedSourceRevision + 1,
                },
              }
            : {}),
          createdAt: "2026-10-12T00:00:00.000Z",
          ...extra,
        },
      }),
    };
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanup = null;
    state.locale = "en";
    state.move = false;
    state.entries = [...defaultItems];
    state.initialDestinationId = "";
    state.source = { id: "lcol_source", name: "Archive", status: "archived", revision: 4 };
    state.destinations = [
      {
        id: "lcol_target",
        name: "Target",
        status: "active",
        revision: 2,
        itemCount: 199,
        presentProductIds: ["prd_a"],
      },
    ];
    vi.clearAllMocks();
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    state,
    firstDestination,
    render,
    choose,
    check,
    submit,
    reviewed,
    success,
  };
}
