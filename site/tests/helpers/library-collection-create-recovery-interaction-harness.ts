import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

export type LibraryCollectionCreateRecoveryHarness = {
  slots: unknown[];
  cursor: number;
  effects: (() => unknown)[];
  fetch: Mock;
  push: Mock;
  refresh: Mock;
  confirm: Mock;
};

export type LibraryCollectionCommandFormComponent = (props: {
  locale: "en" | "ru";
  actorId: string;
  action?: "create" | "duplicate";
  collection?: {
    id: string;
    name: string;
    status: "active" | "archived";
    revision: number;
  };
  copyPreview?: {
    source: {
      id: string;
      name: string;
      status: "active" | "archived";
      revision: number;
    };
    itemCount: number;
    sourceDigest: string;
  };
}) => ReactNode;

const source = { id: "lcol_src", name: "Source", status: "active" as const, revision: 4 };

export const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for create-recovery suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: LibraryCollectionCreateRecoveryHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => "field",
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots))
        harness.slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        harness.slots[i],
        (value: unknown) => {
          harness.slots[i] = typeof value === "function" ? value(harness.slots[i]) : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = { current: initial };
      return harness.slots[i];
    },
    useEffect: (effect: () => unknown) => {
      harness.effects.push(effect);
    },
  });
}

export function createLibraryCollectionCreateRecoveryInteractionHelpers(
  harness: LibraryCollectionCreateRecoveryHarness,
  LibraryCollectionCommandForm: LibraryCollectionCommandFormComponent,
) {
  function render(actorId = "usr_a") {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(
      LibraryCollectionCommandForm({ locale: "en", actorId }) as ReactNode,
    );
  }

  async function mount(actorId = "usr_a", currentActor = actorId) {
    harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: currentActor } }));
    render(actorId);
    for (const effect of harness.effects) effect();
    await vi.waitFor(() =>
      expect(render(actorId).find((node) => node.type === "form")?.props.hidden).toBe(false),
    );
  }

  function changeName(value: string) {
    const input = render().find((node) => node.type === "input");
    if (!input) throw Error("Missing name");
    (input.props.onChange as (event: unknown) => void)({ target: { value } });
  }

  async function submit() {
    const form = render().find((node) => node.type === "form");
    if (!form) throw Error("Missing form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function renderDuplicate(revision = 4, actorId = "usr_a") {
    harness.cursor = 0;
    harness.effects = [];
    const collection = { ...source, revision };
    return flattenReactTestTree(
      LibraryCollectionCommandForm({
        locale: "en",
        actorId,
        action: "duplicate",
        collection,
        copyPreview: { source: collection, itemCount: 2, sourceDigest: "a".repeat(64) },
      }) as ReactNode,
    );
  }

  async function mountDuplicate(revision = 4) {
    harness.fetch.mockResolvedValueOnce(reply({ authenticated: true, user: { id: "usr_a" } }));
    renderDuplicate(revision);
    for (const effect of harness.effects) effect();
    await vi.waitFor(() =>
      expect(renderDuplicate(revision).find((node) => node.type === "form")?.props.hidden).toBe(
        false,
      ),
    );
  }

  async function submitDuplicate(revision = 4) {
    const form = renderDuplicate(revision).find((node) => node.type === "form");
    if (!form) throw Error("Missing copy form");
    await (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function collectionPosts() {
    return harness.fetch.mock.calls.filter(([url]) => url === "/api/library/collections");
  }

  function hasLateResultTitle(tree: FlatTestElement[]) {
    return tree.some(
      (node) =>
        node.props.title ===
        "The result could not be confirmed. Retry the same operation or reload to check the current state.",
    );
  }

  beforeEach(() => {
    harness.slots = [];
    harness.effects = [];
    harness.fetch.mockReset();
    harness.push.mockReset();
    harness.refresh.mockReset();
    harness.confirm.mockReset().mockResolvedValue(true);
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    render,
    mount,
    changeName,
    submit,
    renderDuplicate,
    mountDuplicate,
    submitDuplicate,
    collectionPosts,
    hasLateResultTitle,
  };
}
