import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type ResourceModerationControlsConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
};

type Element = FlatTestElement;

export const productId = "prd_aaaaaaaaaaaaaaaaaaaaaaaa";
export const updatedAt = "2026-11-01T12:00:00.000Z";
export const nextUpdatedAt = "2026-11-01T12:05:00.000Z";
export const reason = "Staff moderation decision for public availability";

type ResourceModerationControlsComponent = (props: {
  product: { id: typeof productId; status: string; updatedAt: typeof updatedAt };
  selectedBuild?: { id: string; status: string; version?: string } | null;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for resource-moderation confirm suites. */
export function mockReactHooks(harness: ResourceModerationControlsConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => "field",
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

function seedControls(
  harness: ResourceModerationControlsConfirmHarness,
  status: "published" | "suspended",
) {
  // lock, observedStatus, observedRevision, reason, busy, saved, error
  harness.slots = [
    { current: false },
    { current: status },
    { current: updatedAt },
    reason,
    false,
    false,
    "",
  ];
}

export function createResourceModerationControlsConfirmInteractionHelpers(
  harness: ResourceModerationControlsConfirmHarness,
  ResourceModerationControls: ResourceModerationControlsComponent,
  confirmAction: ConfirmActionMock,
) {
  function render(status: "published" | "suspended") {
    harness.cursor = 0;
    return flattenReactTestTree(
      ResourceModerationControls({
        product: { id: productId, status, updatedAt },
      }),
    );
  }

  function submit(nodes: Element[]) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw new Error("Missing moderation form");
    return (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({
      preventDefault() {},
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    render,
    submit,
    seedSuspend: () => seedControls(harness, "published"),
    seedRelease: () => seedControls(harness, "suspended"),
  };
}
