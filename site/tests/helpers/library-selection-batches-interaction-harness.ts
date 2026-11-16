import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type LibrarySelectionBatchesHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
};

type LibrarySelectionBatchControlsComponent = (props: {
  collectionId: string;
  locale: string;
  items: { productId: string; title: string | null; downloadable: boolean; hasAccess: boolean }[];
}) => ReactNode;

const items = [
  { productId: "prd_a", title: "Core", downloadable: true, hasAccess: true },
  { productId: "prd_b", title: "Unavailable pin", downloadable: false, hasAccess: true },
];

const preview = {
  collection: { id: "lcol_a", name: "Core", status: "active", revision: 4 },
  choice: { mode: "fixed", productIds: ["prd_a"] },
  previewDigest: "a".repeat(64),
  changedCount: 1,
  items: [
    {
      productId: "prd_a",
      title: "Core",
      version: "1",
      targetBuildId: "bld_a",
      previous: { mode: "latest", revision: 0, buildId: null },
      next: { mode: "fixed", revision: 1, buildId: "bld_a" },
    },
  ],
};

/** Shared react mock factory for selection-batch suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: LibrarySelectionBatchesHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
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

export function createLibrarySelectionBatchesInteractionHelpers(
  harness: LibrarySelectionBatchesHarness,
  LibrarySelectionBatchControls: LibrarySelectionBatchControlsComponent,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      LibrarySelectionBatchControls({ collectionId: "lcol_a", locale: "en", items }),
    );
  }

  function checks() {
    return render().filter((n) => n.type === "input" && n.props.type === "checkbox");
  }

  function change(element: FlatTestElement, checked: boolean) {
    (element.props.onChange as (v: unknown) => void)({ target: { checked } });
  }

  async function click(label: string) {
    const button = render().find((n) => n.type === "button" && n.props.children === label);
    if (!button) throw new Error(`Missing button ${label}`);
    (button.props.onClick as () => void)();
    await new Promise((r) => setTimeout(r, 0));
  }

  async function reviewed() {
    change(checks()[0], true);
    harness.fetch.mockResolvedValueOnce({ ok: true, json: async () => preview });
    await click("Review changes");
  }

  function response(command: unknown) {
    return {
      ok: true,
      json: async () => ({
        replayed: false,
        receipt: {
          id: "lsbr_a",
          requestId: (command as { requestId: string }).requestId,
          command,
          snapshot: {
            collectionId: "lcol_a",
            collectionRevision: 4,
            mode: "fixed",
            items: preview.items.map(({ productId, previous, next }) => ({
              productId,
              previous,
              next,
            })),
          },
          createdAt: "2026-10-12T00:00:00.000Z",
        },
      }),
    };
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    vi.clearAllMocks();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    preview,
    render,
    checks,
    change,
    click,
    reviewed,
    response,
  };
}
