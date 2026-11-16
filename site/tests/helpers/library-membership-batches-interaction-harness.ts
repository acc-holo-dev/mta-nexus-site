import type { LibraryResourceCollections } from "@nexus/domain";
import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type LibraryMembershipBatchesHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  cleanup: (() => void) | null;
};

type LibraryMembershipBatchFormComponent = (props: {
  report: LibraryResourceCollections;
  locale: "ru" | "en";
}) => ReactNode;

function membershipBatchesFixture(): LibraryResourceCollections {
  return {
    schemaVersion: 1,
    generatedAt: "2026-10-12T00:00:00.000Z",
    resource: { productId: "prd_a", title: null, available: false, canAdd: true },
    collections: [
      {
        id: "lcol_a",
        name: "Core",
        status: "active",
        revision: 2,
        itemCount: 1,
        inCollection: true,
      },
      {
        id: "lcol_b",
        name: "Empty",
        status: "active",
        revision: 4,
        itemCount: 0,
        inCollection: false,
      },
    ],
    collectionLimit: 30,
    itemLimit: 200,
  };
}

/** Shared react mock factory for membership-batch suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: LibraryMembershipBatchesHarness) {
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

export function createLibraryMembershipBatchesInteractionHelpers(
  harness: LibraryMembershipBatchesHarness,
  LibraryMembershipBatchForm: LibraryMembershipBatchFormComponent,
) {
  const state: { report: LibraryResourceCollections; locale: "en" | "ru" } = {
    report: membershipBatchesFixture(),
    locale: "en",
  };

  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      LibraryMembershipBatchForm({ report: state.report, locale: state.locale }),
    );
  }

  function check(index: number, value: boolean) {
    const input = render().filter((n) => n.type === "input")[index];
    if (!input) throw Error("Missing checkbox");
    (input.props.onChange as (e: unknown) => void)({ target: { checked: value } });
  }

  function submit(tree: FlatTestElement[] = render()) {
    const form = tree.find((n) => n.type === "form");
    if (!form) throw Error("Missing form");
    return (form.props.onSubmit as (e: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function reviewed() {
    check(0, false);
    check(1, true);
    check(2, true);
  }

  function success(init: RequestInit, original = membershipBatchesFixture(), partial = false) {
    const command = JSON.parse(String(init.body));
    const children = command.changes.map(
      (
        change: { collectionId: string; expectedRevision: number; inCollection: boolean },
        index: number,
      ) => {
        const collection = original.collections.find((c) => c.id === change.collectionId);
        if (!collection) throw Error("Missing fixture collection");
        const requestId = `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`;
        return {
          id: `lcr_${index}`,
          requestId,
          command: {
            requestId,
            action: change.inCollection ? "add" : "remove",
            expectedRevision: change.expectedRevision,
            productId: original.resource.productId,
          },
          collection: {
            id: collection.id,
            name: collection.name,
            status: "active",
            revision: change.expectedRevision + 1,
          },
          createdAt: "2026-10-12T00:00:00.000Z",
        };
      },
    );
    return {
      ok: true,
      status: 200,
      json: async () => ({
        replayed: false,
        receipt: {
          id: "lmb_a",
          requestId: command.requestId,
          productId: original.resource.productId,
          command,
          children: partial ? children.slice(1) : children,
          createdAt: "2026-10-12T00:00:01.000Z",
        },
      }),
    };
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanup = null;
    state.report = membershipBatchesFixture();
    state.locale = "en";
    vi.clearAllMocks();
    harness.fetch.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    state,
    render,
    check,
    submit,
    reviewed,
    success,
    fixture: membershipBatchesFixture,
  };
}
