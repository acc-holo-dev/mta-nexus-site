import type { ProductStatus, ResourceLifecycleAction } from "@nexus/domain";
import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type ResourceLifecycleControlsConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
};

type Element = FlatTestElement;

export const productId = "prd_aaaaaaaaaaaaaaaaaaaaaaaa";
export const updatedAt = "2026-10-11T00:00:00.000Z";
export const nextUpdatedAt = "2026-10-11T00:00:01.000Z";
export const reason = "Lifecycle change after review";

type ResourceLifecycleControlsComponent = (props: {
  product: { id: typeof productId; status: ProductStatus; updatedAt: typeof updatedAt };
  selectedBuild?: { id: string; status: string; version?: string } | null;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for resource-lifecycle confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ResourceLifecycleControlsConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => "resource-lifecycle",
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
      // Confirm coverage seeds slots directly; skip status/revision sync effect.
    },
  });
}

export function createResourceLifecycleControlsConfirmInteractionHelpers(
  harness: ResourceLifecycleControlsConfirmHarness,
  ResourceLifecycleControls: ResourceLifecycleControlsComponent,
  confirmAction: ConfirmActionMock,
) {
  function seedControls(
    status: ProductStatus,
    action: ResourceLifecycleAction,
    options: { confirmed?: boolean; reason?: string } = {},
  ) {
    // lock, observedStatus, observedRevision, action, busy, confirmed, reason, error, saved
    harness.slots = [
      { current: false },
      { current: status },
      { current: updatedAt },
      action,
      false,
      options.confirmed ?? true,
      options.reason ?? reason,
      "",
      false,
    ];
  }

  function render(status: ProductStatus = "published") {
    harness.cursor = 0;
    return flattenReactTestTree(
      ResourceLifecycleControls({
        product: { id: productId, status, updatedAt },
      }),
    );
  }

  function submit(nodes: Element[]) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw new Error("Missing lifecycle form");
    return (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault() {},
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    seedControls("published", "archive");
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return { render, submit, seedControls };
}
