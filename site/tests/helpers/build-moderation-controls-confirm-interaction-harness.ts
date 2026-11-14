import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";

type BuildModerationControlsConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
};

type Element = ReactElement<Record<string, unknown>>;

/** Props match fixture literals so BuildModerationControls stays assignable under strictFunctionTypes. */
type BuildModerationControlsComponent = (props: {
  buildId: typeof buildId;
  scanStatus: "clean";
  hasScanProvenance: true;
  expectedRevision: typeof expectedRevision;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const buildId = "bld_cccccccccccccccccccccccc";
export const notes = "Clean scan reviewed for release";
export const expectedRevision = 4;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for build-moderation confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: BuildModerationControlsConfirmHarness) {
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
  });
}

function descendants(node: ReactNode): Element[] {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as Element;
  const type = element.type as { displayName?: string } | string;
  if (typeof type === "object" && type?.displayName === "Button") {
    return [
      { ...element, type: "button" } as Element,
      ...descendants(element.props.children as ReactNode),
    ];
  }
  return [element, ...descendants(element.props.children as ReactNode)];
}

function seedControls(harness: BuildModerationControlsConfirmHarness) {
  // busy ref, uncertain, notes, pending, confirmedWrite, error
  harness.slots = [{ current: false }, false, notes, null, false, null];
}

export function createBuildModerationControlsConfirmInteractionHelpers(
  harness: BuildModerationControlsConfirmHarness,
  BuildModerationControls: BuildModerationControlsComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return descendants(
      BuildModerationControls({
        buildId,
        scanStatus: "clean",
        hasScanProvenance: true,
        expectedRevision,
      }),
    );
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
    seedControls(harness);
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return { render, actionButton, seedControls: () => seedControls(harness) };
}
