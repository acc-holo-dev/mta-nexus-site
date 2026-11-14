import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type PublicProfileConflictHarness = {
  slots: unknown[];
  cursor: number;
  effect: null | (() => undefined | (() => void));
  request: Mock;
  refresh: Mock;
  locale: "en" | "ru";
};

type PublicProfileFormComponent = () => ReactNode;

type Element = FlatTestElement;

export const original = {
  id: "usr_1",
  username: "author",
  displayName: "Original",
  bio: "Old bio",
  avatarUrl: "",
  updatedAt: "2026-10-11T00:00:00.000Z",
};

export const latest = {
  ...original,
  displayName: "Remote name",
  bio: "Remote bio",
  updatedAt: "2026-10-11T00:00:01.000Z",
};

class DraftFormData {
  get(name: string) {
    return (
      ({ displayName: "My draft", bio: "My unsaved bio", avatarUrl: "" } as Record<string, string>)[
        name
      ] ?? null
    );
  }
}

/** Shared react mock factory for public-profile conflict suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: PublicProfileConflictHarness) {
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
    useEffect: (effect: () => undefined | (() => void)) => {
      harness.effect = effect;
    },
  });
}

export function createPublicProfileConflictInteractionHelpers(
  harness: PublicProfileConflictHarness,
  PublicProfileForm: PublicProfileFormComponent,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(PublicProfileForm());
  }

  async function load() {
    harness.request.mockResolvedValueOnce({ profile: original });
    render();
    const cleanup = harness.effect?.();
    await vi.waitFor(() => expect(render().some((node) => node.type === "form")).toBe(true));
    return cleanup;
  }

  async function save(nodes: Element[] = render()) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw new Error("Missing profile form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({
      preventDefault() {},
      currentTarget: {},
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.effect = null;
    harness.request.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("FormData", DraftFormData);
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, load, save };
}
