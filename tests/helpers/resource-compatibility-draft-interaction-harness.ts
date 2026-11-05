import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type ResourceCompatibilityDraftHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  locale: "en" | "ru";
};

type Element = FlatTestElement;

/** Exact fixture literals so real form props stay assignable under strictFunctionTypes. */
const revision = "2026-10-11T00:00:00.000Z";
const later = "2026-10-11T00:00:01.000Z";

const original = {
  id: "prd_a",
  updatedAt: revision,
  suspended: false,
  compatibility: { mtaMinVersion: "1.6.0", dependencies: ["resource-a"] },
};

export const latest = {
  ...original,
  updatedAt: later,
  compatibility: { mtaMinVersion: "1.6.1", dependencies: ["resource-b"] },
};

export const actor = {
  id: "usr_a",
  username: "author",
  displayName: "Author",
  bio: "",
  avatarUrl: "",
  updatedAt: revision,
};

type ProductSnapshot = typeof original | typeof latest;

type ResourceCompatibilityFormComponent = (props: {
  actorId: "usr_a";
  product: ProductSnapshot;
}) => ReactNode;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for resource-compatibility draft suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ResourceCompatibilityDraftHarness) {
  return async (originalModule: () => Promise<typeof import("react")>) => ({
    ...(await originalModule()),
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
    useId: () => "compatibility-field",
  });
}

export function createResourceCompatibilityDraftInteractionHelpers(
  harness: ResourceCompatibilityDraftHarness,
  ResourceCompatibilityForm: ResourceCompatibilityFormComponent,
) {
  function render(product: ProductSnapshot = original) {
    harness.cursor = 0;
    return flattenReactTestTree(
      ResourceCompatibilityForm({ actorId: "usr_a", product }) as ReactNode,
    );
  }

  function edit() {
    const nodes = render();
    const dependencies = nodes.find((node) => node.type === "textarea");
    if (!dependencies) throw Error("Missing dependency editor");
    (dependencies.props.onChange as (event: unknown) => void)({ target: { value: "my-resource" } });
  }

  function submit(nodes: Element[] = render()) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw Error("Missing compatibility form");
    (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, edit, submit };
}
