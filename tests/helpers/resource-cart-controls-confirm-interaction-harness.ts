import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { getResourceCommerceCopy } from "../../apps/web/src/lib/resource-commerce-i18n";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type ResourceCartControlsConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
};

type Element = FlatTestElement;

/** Exact fixture literals so real ResourceCartControls props stay assignable under strictFunctionTypes. */
export const item = {
  productId: "prd_aaaaaaaaaaaaaaaaaaaaaaaa",
  title: "Sample Resource",
  slug: "sample-resource",
  version: "1.0.0",
  available: true,
  alreadyOwned: false,
};

export const initialCart = { items: [item], limit: 20 };

type ResourceCartControlsComponent = (props: { initialCart: typeof initialCart }) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for resource-cart-controls confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ResourceCartControlsConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] =
            typeof value === "function"
              ? (value as (current: unknown) => unknown)(harness.slots[index])
              : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useEffect: () => {
      // Cart state is seeded below; skip abort cleanup registration for confirm coverage.
    },
  });
}

function seedCart(harness: ResourceCartControlsConfirmHarness) {
  // cart, review, busy, error, receiptId, active ref, lock ref, pending ref
  harness.slots = [
    initialCart,
    null,
    false,
    "",
    null,
    { current: null },
    { current: false },
    { current: null },
  ];
}

export function createResourceCartControlsConfirmInteractionHelpers(
  harness: ResourceCartControlsConfirmHarness,
  ResourceCartControls: ResourceCartControlsComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(ResourceCartControls({ initialCart }));
  }

  function removeButton(nodes: Element[]) {
    const copy = getResourceCommerceCopy("en");
    const found = nodes.find(
      (node) =>
        node.type === "button" &&
        node.props.children === copy.remove &&
        node.props["aria-label"] === `${copy.remove}: ${item.title}`,
    );
    if (!found) throw new Error("Missing cart remove button");
    return found;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    seedCart(harness);
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return { render, removeButton };
}
