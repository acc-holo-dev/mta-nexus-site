import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type ResourceReleaseWatchBatchHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  reload: Mock;
  locale: string;
  cleanup: (() => void) | null;
};

type ResourceReleaseWatchBatchControlsComponent = (props: {
  items: { productId: string; enabled: boolean; revision: number; title: string | null }[];
  locale: "en" | "ru";
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

const items = [
  { productId: "prd_b", enabled: true, revision: 3, title: null },
  { productId: "prd_a", enabled: true, revision: 1, title: "Core" },
];

/** Shared react mock factory for resource-release-watch-batch suites. */
export function mockReactHooks(harness: ResourceReleaseWatchBatchHarness) {
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

export function createResourceReleaseWatchBatchInteractionHelpers(
  harness: ResourceReleaseWatchBatchHarness,
  ResourceReleaseWatchBatchControls: ResourceReleaseWatchBatchControlsComponent,
  confirmAction?: ConfirmActionMock,
) {
  type Element = FlatTestElement;

  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      ResourceReleaseWatchBatchControls({ items, locale: harness.locale as "en" | "ru" }),
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
        enabled: false,
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
    harness.cleanup = null;
    harness.locale = "en";
    vi.clearAllMocks();
    confirmAction?.mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, checks, change, button, click, ack, reviewed };
}
