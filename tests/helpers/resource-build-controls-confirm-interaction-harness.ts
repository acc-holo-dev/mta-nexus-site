import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type ResourceBuildControlsConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
};

type Element = FlatTestElement;

/** Exact fixture literals so real ResourceBuildControls props stay assignable under strictFunctionTypes. */
export const build = {
  id: "bld_cccccccccccccccccccccccc",
  productId: "prd_dddddddddddddddddddddddd",
  version: "2.0.0",
  status: "pending_review" as const,
  revision: 4,
  releaseNotes: "Ready",
  mtaVersionTarget: "1.6",
};

const reason = "Retiring after review";

type ResourceBuildControlsComponent = (props: {
  build: typeof build;
  withdrawn: boolean;
  trustedScan: boolean;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for resource-build-controls confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ResourceBuildControlsConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => "build-controls",
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
  });
}

export function createResourceBuildControlsConfirmInteractionHelpers(
  harness: ResourceBuildControlsConfirmHarness,
  ResourceBuildControls: ResourceBuildControlsComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    // busy ref, current, pending, notes, target, reason, message, uncertain
    harness.slots = [
      { current: false },
      build,
      false,
      build.releaseNotes,
      build.mtaVersionTarget,
      reason,
      "",
      false,
    ];
    harness.cursor = 0;
    return flattenReactTestTree(
      ResourceBuildControls({
        build,
        withdrawn: false,
        trustedScan: true,
      }),
    );
  }

  function control(nodes: Element[], label: string) {
    return findTestButton(nodes, label);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return { render, control, reason };
}
