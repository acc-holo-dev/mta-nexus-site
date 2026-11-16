import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type ServerReviewDraftRefreshHarness = {
  slots: unknown[];
  cursor: number;
  effects: Array<() => undefined | (() => void)>;
  fetch: Mock;
  focus: (() => void) | null;
};

/** Exact fixture literals so real panel props stay assignable under strictFunctionTypes. */
type Review = {
  id: string;
  text: string;
  rating: number;
  status: "published" | "withdrawn" | "removed";
  revision: number;
  interactionSource: "follow";
  moderationReason?: string | null;
  author?: { username: string; displayName: string } | null;
};

type PublicPage = {
  reviews: Review[];
  total: number;
  page: number;
  totalPages: number;
};

type MinePayload = {
  review: Review;
  canReview: boolean;
  eligibility: string;
};

type ServerReviewPanelComponent = (props: {
  serverId: string;
  initialPage: PublicPage;
  loadState?: "ready" | "unavailable";
}) => ReactNode;

const page: PublicPage = { reviews: [], total: 0, page: 1, totalPages: 1 };

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function review(text: string, revision: number): MinePayload {
  return {
    review: {
      id: "review",
      text,
      rating: 4,
      status: "published",
      revision,
      interactionSource: "follow",
    },
    canReview: true,
    eligibility: "ok",
  };
}

/** Shared react mock factory for server-review draft-refresh suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ServerReviewDraftRefreshHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots))
        harness.slots[index] =
          typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [
        harness.slots[index],
        (value: unknown) => {
          harness.slots[index] = typeof value === "function" ? value(harness.slots[index]) : value;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) harness.slots[index] = { current: initial };
      return harness.slots[index];
    },
    useCallback: (fn: unknown) => fn,
    useEffect: (effect: () => undefined | (() => void)) => {
      harness.effects.push(effect);
    },
    useId: () => "server-review-status",
  });
}

export function createServerReviewDraftRefreshInteractionHelpers(
  harness: ServerReviewDraftRefreshHarness,
  ServerReviewPanel: ServerReviewPanelComponent,
) {
  function render(serverId = "srv_demo") {
    harness.cursor = 0;
    harness.effects = [];
    return flattenReactTestTree(ServerReviewPanel({ serverId, initialPage: page }) as ReactNode);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.effects = [];
    harness.focus = null;
    harness.fetch.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
    vi.stubGlobal("document", {
      visibilityState: "visible",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("window", {
      addEventListener: (name: string, cb: () => void) => {
        if (name === "focus") harness.focus = cb;
      },
      removeEventListener: vi.fn(),
      location: { pathname: "/servers/demo", search: "", hash: "" },
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render };
}
