import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type LibraryCollectionsInteractionHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
  push: Mock;
  cleanup: (() => void) | null;
};

/** Props match the fixture literals so real LibraryCollectionCommandForm stays assignable. */
type LibraryCollectionCommandFormComponent = (props: {
  locale: "en" | "ru";
  actorId: string;
  action?:
    | "create"
    | "archive"
    | "remove"
    | "duplicate"
    | "add"
    | "rename"
    | "restore";
  collection?: {
    id: string;
    name: string;
    status: "active" | "archived";
    revision: number;
  };
  productId?: string;
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
  returnHref?: string;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = FlatTestElement;

const collection = { id: "lcol_a", name: "Core", status: "active" as const, revision: 4 };

const defaultPreview = {
  source: collection,
  itemCount: 200,
  sourceDigest: "a".repeat(64),
};

/** Shared react mock factory for library-collections interaction suites. */
export function mockReactHooks(harness: LibraryCollectionsInteractionHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useId: () => "field",
    useEffect: (effect: () => (() => void) | undefined) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) {
        harness.slots[i] = true;
        const cleanup = effect();
        if (!harness.cleanup && cleanup) harness.cleanup = cleanup;
      }
    },
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = initial;
      return [
        harness.slots[i],
        (v: unknown) => {
          harness.slots[i] = v;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = { current: initial };
      return harness.slots[i];
    },
  });
}

export function createLibraryCollectionsInteractionHelpers(
  harness: LibraryCollectionsInteractionHarness,
  LibraryCollectionCommandForm: LibraryCollectionCommandFormComponent,
  confirmAction: ConfirmActionMock,
) {
  function render(
    action: "create" | "archive" | "remove" | "duplicate" = "remove",
    preview = defaultPreview,
    overrides: Partial<Parameters<LibraryCollectionCommandFormComponent>[0]> = {},
  ) {
    harness.cursor = 0;
    return flattenReactTestTree(
      LibraryCollectionCommandForm({
        locale: "en",
        actorId: "usr_a",
        action,
        ...(action === "create" ? {} : { collection }),
        productId: "prd_a",
        ...(action === "duplicate" ? { copyPreview: preview } : {}),
        ...overrides,
      }),
    );
  }

  async function mountDuplicate(preview = defaultPreview) {
    harness.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ authenticated: true, user: { id: "usr_a" } }),
    });
    render("duplicate", preview);
    await vi.waitFor(() =>
      expect(render("duplicate", preview).find((node) => node.type === "form")?.props.hidden).toBe(
        false,
      ),
    );
    harness.fetch.mockClear();
  }

  function submit(tree: Element[]) {
    const form = tree.find((n) => n.type === "form");
    if (!form) throw new Error("Missing command form");
    return (form.props.onSubmit as (event: unknown) => Promise<void>)({ preventDefault() {} });
  }

  function success(command: unknown, snapshot: unknown) {
    return {
      ok: true,
      json: async () => ({
        replayed: false,
        receipt: {
          id: "lcr_a",
          requestId: (command as { requestId: string }).requestId,
          command,
          collection: snapshot,
          createdAt: "2026-10-11T00:00:00.000Z",
        },
      }),
    };
  }

  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanup = null;
    vi.clearAllMocks();
    confirmAction.mockReset().mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
    const data = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  return {
    collection,
    render,
    mountDuplicate,
    submit,
    success,
  };
}
