import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type ResourceVariantsDraftHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  locale: "en" | "ru";
};

type Element = FlatTestElement;

/** Exact fixture literals so real form props stay assignable under strictFunctionTypes. */
const variant = {
  productId: "prd_a",
  title: "Resource A",
  label: "Base",
  slug: "resource-a",
  currentVersion: "1.0",
  status: "published" as const,
};

export const managed = {
  anchorProductId: "prd_a",
  group: { id: "vgrp_a", revision: 2, title: "Original group", variants: [variant] },
};

export const latest = {
  ...managed,
  group: { ...managed.group, revision: 3, title: "Changed elsewhere" },
};

export const latestOtherAnchor = {
  ...latest,
  anchorProductId: "prd_other",
};

export const actor = {
  id: "usr_a",
  username: "author",
  displayName: "Author",
  bio: "",
  avatarUrl: "",
  updatedAt: "2026-10-11T00:00:00.000Z",
};

type ManagedSnapshot = typeof managed | typeof latest | typeof latestOtherAnchor;

type ResourceVariantsFormComponent = (props: {
  actorId: "usr_a";
  product: { id: "prd_a"; title: "Resource A" };
  managed: ManagedSnapshot;
  initialCandidates: { candidates: []; page: 1; hasMore: false };
}) => ReactNode;

export const response = (body: unknown, status = 200, actorId?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...(actorId ? { "x-nexus-actor-id": actorId } : {}),
    },
  });

/** Shared react mock factory for resource-variants draft suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ResourceVariantsDraftHarness) {
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
    useId: () => "variants-field",
  });
}

export function createResourceVariantsDraftInteractionHelpers(
  harness: ResourceVariantsDraftHarness,
  ResourceVariantsForm: ResourceVariantsFormComponent,
) {
  function render(snapshot: ManagedSnapshot = managed) {
    harness.cursor = 0;
    return flattenReactTestTree(
      ResourceVariantsForm({
        actorId: "usr_a",
        product: { id: "prd_a", title: "Resource A" },
        managed: snapshot,
        initialCandidates: { candidates: [], page: 1, hasMore: false },
      }),
    );
  }

  function edit() {
    const nodes = render();
    const title = nodes.find((node) => node.props.id === "variants-field-title");
    const reason = nodes.find((node) => node.props.id === "variants-field-reason");
    if (!title || !reason) throw Error("Missing group editor");
    (title.props.onChange as (event: unknown) => void)({ target: { value: "My draft group" } });
    (reason.props.onChange as (event: unknown) => void)({ target: { value: "My draft reason" } });
  }

  function submit(nodes: Element[] = render()) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw Error("Missing group form");
    (form.props.onSubmit as (event: unknown) => void)({ preventDefault() {} });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.fetch.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, edit, submit };
}
