import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { resourceMediaCopy } from "../../apps/web/src/lib/resource-media-i18n";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type ResourceMediaEditorConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
};

type Element = FlatTestElement;

/** Exact fixture literals so real ResourceMediaEditor props stay assignable under strictFunctionTypes. */
export const initial = {
  product: {
    id: "prd_aaaaaaaaaaaaaaaaaaaaaaaa",
    title: "Race kit",
    status: "draft",
    updatedAt: "2026-10-11T00:00:00.000Z",
  },
  items: [
    {
      id: "rmi_aaaaaaaaaaaaaaaaaaaaaaaa",
      caption: "Front cover",
      position: 0,
      width: 1280,
      height: 720,
      url: "/api/resource-media/rmi_aaaaaaaaaaaaaaaaaaaaaaaa",
    },
  ],
};

type ResourceMediaEditorComponent = (props: { initial: typeof initial; locale: "en" }) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for resource-media-editor confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ResourceMediaEditorConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initialState: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = initialState;
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
    useRef: (initialRef: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initialRef };
      return harness.slots[index];
    },
    useEffect: () => {
      // Abort cleanup is out of scope for confirm coverage.
    },
  });
}

function seed(harness: ResourceMediaEditorConfirmHarness) {
  // current, items, busy, message, error, abort ref, inFlight ref
  harness.slots = [initial, initial.items, false, "", "", { current: null }, { current: false }];
}

export function createResourceMediaEditorConfirmInteractionHelpers(
  harness: ResourceMediaEditorConfirmHarness,
  ResourceMediaEditor: ResourceMediaEditorComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(ResourceMediaEditor({ initial, locale: "en" }));
  }

  function removeButton(nodes: Element[]) {
    return findTestButton(nodes, resourceMediaCopy("en").remove);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    seed(harness);
    confirmAction.mockResolvedValue(true);
    harness.fetch.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return { render, removeButton };
}
