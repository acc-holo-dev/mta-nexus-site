import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type CollectionReleaseWatchesInteractionHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  reload: Mock;
  locale: string;
};

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type CollectionReleaseWatchesControlsComponent = (props: {
  items: {
    productId: string;
    enabled: boolean;
    revision: number;
    title: string | null;
    available?: boolean;
  }[];
  locale: "en" | "ru";
  collection: { id: string; revision: number; status: "active" | "archived" };
  activeWatchCount: number;
}) => ReactNode;

const items = [
  { productId: "prd_b", enabled: false, revision: 2, title: "Dependency", available: true },
  { productId: "prd_a", enabled: false, revision: 0, title: "Root", available: true },
  { productId: "prd_hidden", enabled: false, revision: 0, title: null, available: false },
  { productId: "prd_enabled", enabled: true, revision: 3, title: "Watched", available: true },
];

/** Shared react mock factory for collection-release-watches suites. */
export function mockReactHooks(harness: CollectionReleaseWatchesInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useEffect: () => {},
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

export function createCollectionReleaseWatchesInteractionHelpers(
  harness: CollectionReleaseWatchesInteractionHarness,
  ResourceReleaseWatchBatchControls: CollectionReleaseWatchesControlsComponent,
  confirmAction?: ConfirmActionMock,
) {
  type Element = FlatTestElement;
  let activeWatchCount = 4;
  let collectionId = "lcol_a";

  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      ResourceReleaseWatchBatchControls({
        items,
        locale: harness.locale as "en" | "ru",
        collection: { id: collectionId, revision: 3, status: "active" },
        activeWatchCount,
      }),
    );
  }

  function checks() {
    return render().filter((n) => n.type === "input" && n.props.type === "checkbox");
  }

  function change(n: Element, checked: boolean) {
    (n.props.onChange as (e: unknown) => void)({ target: { checked } });
  }

  function button(label: string) {
    const b = render().find((n) => n.type === "button" && n.props.children === label);
    if (!b) throw new Error(`Missing ${label}`);
    return b;
  }

  async function click(label: string) {
    (button(label).props.onClick as () => void)();
    await new Promise((r) => setTimeout(r, 0));
  }

  function ack(init: RequestInit) {
    const command = JSON.parse(String(init.body));
    return {
      changedCount: command.items.length,
      items: command.items.map((item: { productId: string; expectedRevision: number }) => ({
        productId: item.productId,
        enabled: true,
        revision: item.expectedRevision + 1,
        updatedAt: "2026-10-12T00:00:00.000Z",
      })),
    };
  }

  function reviewed() {
    change(checks()[0], true);
    change(checks()[1], true);
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    harness.locale = "en";
    activeWatchCount = 4;
    collectionId = "lcol_a";
    vi.clearAllMocks();
    confirmAction?.mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    render,
    checks,
    change,
    button,
    click,
    ack,
    reviewed,
    setActiveWatchCount: (next: number) => {
      activeWatchCount = next;
    },
    setCollectionId: (next: string) => {
      collectionId = next;
    },
  };
}
