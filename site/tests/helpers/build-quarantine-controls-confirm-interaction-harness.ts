import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type BuildQuarantineControlsConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
};

/** Props match the fixture literals so real BuildQuarantineControls stays assignable. */
type BuildQuarantineControlsComponent = (props: {
  buildId: typeof buildId;
  status: "published" | "quarantined";
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = FlatTestElement;

export const buildId = "bld_cccccccccccccccccccccccc";
export const reason = "Evidence for operator review";

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for build-quarantine confirm suites. */
export function mockReactHooks(harness: BuildQuarantineControlsConfirmHarness) {
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
  });
}

function seedControlsSlots(
  harness: BuildQuarantineControlsConfirmHarness,
  notifyAffectedDownloaders = false,
) {
  // reason, notifyAffectedDownloaders, pending, error
  harness.slots = [reason, notifyAffectedDownloaders, null, null];
}

export function createBuildQuarantineControlsConfirmInteractionHelpers(
  harness: BuildQuarantineControlsConfirmHarness,
  BuildQuarantineControls: BuildQuarantineControlsComponent,
  confirmAction: ConfirmActionMock,
) {
  function seedControls(notifyAffectedDownloaders = false) {
    seedControlsSlots(harness, notifyAffectedDownloaders);
  }

  function render(status: "published" | "quarantined") {
    harness.cursor = 0;
    return flattenReactTestTree(BuildQuarantineControls({ buildId, status }));
  }

  function actionButton(nodes: Element[], label: string) {
    const found = nodes.find((node) => {
      if (node.type !== "button") return false;
      const children = node.props.children;
      if (children === label) return true;
      return Array.isArray(children) && children.includes(label);
    });
    if (!found) throw new Error(`Missing ${label}`);
    return found;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    seedControls();
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
    actionButton,
    seedControls,
  };
}
