import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type RetireBuildFormConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
};

type Element = FlatTestElement;

/** Exact fixture literals so real RetireBuildForm props stay assignable under strictFunctionTypes. */
export const productId = "prd_aaaaaaaaaaaaaaaaaaaaaaaa";
export const buildId = "bld_bbbbbbbbbbbbbbbbbbbbbbbb";
export const version = "1.4.0";
export const revision = 3;
export const reason = "No longer maintained";

type RetireBuildFormComponent = (props: {
  productId: typeof productId;
  buildId: typeof buildId;
  version: typeof version;
  revision: typeof revision;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for retire-build-form confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: RetireBuildFormConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => "retire-reason",
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

export function createRetireBuildFormConfirmInteractionHelpers(
  harness: RetireBuildFormConfirmHarness,
  RetireBuildForm: RetireBuildFormComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      RetireBuildForm({
        productId,
        buildId,
        version,
        revision,
      }),
    );
  }

  function submit(nodes: Element[], submitReason = reason) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw new Error("Missing retire form");
    const OriginalFormData = globalThis.FormData;
    vi.stubGlobal(
      "FormData",
      class extends OriginalFormData {
        constructor() {
          super();
          this.set("reason", submitReason);
        }
      },
    );
    return (
      form.props.onSubmit as (event: {
        preventDefault: () => void;
        currentTarget: object;
      }) => Promise<void>
    )({
      preventDefault() {},
      currentTarget: {},
    });
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

  return { render, submit };
}
