import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type ServerReviewPanelConfirmHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
  refresh: Mock;
};

type Element = FlatTestElement;

/** Exact fixture literals so real ServerReviewPanel props stay assignable under strictFunctionTypes. */
type PublicPage = {
  reviews: never[];
  total: number;
  page: number;
  totalPages: number;
};

type ServerReviewPanelComponent = (props: {
  serverId: typeof serverId;
  initialPage: PublicPage;
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const serverId = "srv_demo";
export const reviewText = "Solid community server";
export const emptyPage: PublicPage = { reviews: [], total: 0, page: 1, totalPages: 1 };

const publishedMine = {
  review: {
    id: "cmt_server",
    text: reviewText,
    rating: 5,
    status: "published" as const,
    revision: 2,
    interactionSource: "follow" as const,
    moderationReason: null,
    author: { username: "alex", displayName: "Alex" },
  },
  canReview: false,
  eligibility: "ok",
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for server-review-panel confirm suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ServerReviewPanelConfirmHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        harness.slots[index] =
          typeof initial === "function" ? (initial as () => unknown)() : initial;
      }
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
    useCallback: (fn: unknown) => fn,
    useEffect: () => {
      // Seeded mine/signedIn state covers withdraw confirm; skip visibility refresh.
    },
    useId: () => "server-review-status",
  });
}

export function createServerReviewPanelConfirmInteractionHelpers(
  harness: ServerReviewPanelConfirmHarness,
  ServerReviewPanel: ServerReviewPanelComponent,
  confirmAction: ConfirmActionMock,
) {
  function seedPublished() {
    // statusRef, page, unavailable, retrying, mine, signedIn, text, rating,
    // busy, notice, confirmed, loginHref, registerHref
    harness.slots = [
      { current: null },
      emptyPage,
      false,
      false,
      publishedMine,
      true,
      reviewText,
      5,
      false,
      null,
      false,
      "/auth/login?next=%2Fservers%2Fdemo",
      "/auth/register?next=%2Fservers%2Fdemo",
    ];
  }

  function render() {
    seedPublished();
    harness.cursor = 0;
    return flattenReactTestTree(
      ServerReviewPanel({
        serverId,
        initialPage: emptyPage,
      }) as ReactNode,
    );
  }

  function control(nodes: Element[], label: string) {
    return findTestButton(nodes, label);
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

  return { render, control };
}
