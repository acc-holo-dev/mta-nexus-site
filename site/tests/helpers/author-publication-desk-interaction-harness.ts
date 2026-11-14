import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { type FlatTestElement, flattenReactTestTree } from "./flatten-react-test-tree";

type AuthorPublicationDeskHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
  refresh: Mock;
  reload: Mock;
};

/** Props use fixture literals so AuthorPublicationRestore stays assignable under strictFunctionTypes. */
type AuthorPublicationRestoreComponent = (props: {
  id: "article";
  revision: typeof revision;
  locale: "en" | "ru";
  organizationId?: string;
  serverId?: string;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

type Element = FlatTestElement;

export const revision = "2026-10-11T00:00:00.123456Z";
export const next = "2026-10-11T00:00:00.123457Z";

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for author-publication-desk suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: AuthorPublicationDeskHarness) {
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
    useEffect: (effect: () => () => void) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        harness.slots[index] = true;
        harness.cleanups.push(effect());
      }
    },
  });
}

export function createAuthorPublicationDeskInteractionHelpers(
  harness: AuthorPublicationDeskHarness,
  AuthorPublicationRestore: AuthorPublicationRestoreComponent,
  confirmAction: ConfirmActionMock,
) {
  function render(locale: "en" | "ru" = "en", organizationId?: string, serverId?: string) {
    harness.cursor = 0;
    return flattenReactTestTree(
      AuthorPublicationRestore({ id: "article", revision, locale, organizationId, serverId }),
    );
  }

  function button(nodes: Element[], label: string) {
    const element = nodes.find((node) => node.type === "button" && node.props.children === label);
    if (!element) throw Error(`Missing ${label}`);
    return element;
  }

  function click(nodes: Element[], label: string) {
    return (button(nodes, label).props.onClick as () => void)();
  }

  function errorState(nodes: Element[]) {
    return nodes.find(
      (node) =>
        typeof node.type !== "string" && (node.type as { name?: string }).name === "ErrorState",
    );
  }

  function hasErrorAlert(nodes: Element[], title?: string) {
    const state = errorState(nodes);
    if (!state || typeof state.props.title !== "string") return false;
    if (title !== undefined && state.props.title !== title) return false;
    return nodes.some((node) => node.props.role === "alert");
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    confirmAction.mockReset().mockResolvedValue(true);
    harness.fetch
      .mockReset()
      .mockResolvedValue(response({ id: "article", status: "draft", revision: next }));
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("window", { location: { reload: harness.reload } });
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup();
    vi.unstubAllGlobals();
  });

  return {
    render,
    button,
    click,
    errorState,
    hasErrorAlert,
  };
}
