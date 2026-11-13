import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { resourceReviewCopy } from "../../site/src/lib/resource-review-i18n";
import { findTestButton, flattenReactTestTree } from "./flatten-react-test-tree";

type ReviewWithdrawInteractionHarness = {
  slots: unknown[];
  cursor: number;
  cleanups: (() => void)[];
  fetch: Mock;
};

/** Props match the fixture literals so real ResourceReviewEditor stays assignable. */
type ResourceReviewEditorComponent = (props: {
  productId: "prd_a";
  review: {
    text: string;
    rating: 5;
    status: "published";
    revision: 2;
  };
  canReview: false;
  locale: "en";
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const publishedReview = {
  text: "Solid resource review",
  rating: 5 as const,
  status: "published" as const,
  revision: 2,
};

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for review-withdraw interaction suites. */
export function mockReactHooks(harness: ReviewWithdrawInteractionHarness) {
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
    useEffect: (effect: () => undefined | (() => void)) => {
      const index = harness.cursor++;
      if (!(index in harness.slots)) {
        harness.slots[index] = true;
        const cleanup = effect();
        if (cleanup) harness.cleanups.push(cleanup);
      }
    },
  });
}

export function createReviewWithdrawInteractionHelpers(
  harness: ReviewWithdrawInteractionHarness,
  ResourceReviewEditor: ResourceReviewEditorComponent,
  confirmAction: ConfirmActionMock,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      ResourceReviewEditor({
        productId: "prd_a",
        review: {
          text: publishedReview.text,
          rating: 5,
          status: "published",
          revision: 2,
        },
        canReview: false,
        locale: "en",
      }),
    );
  }

  function withdrawButton(nodes = render()) {
    return findTestButton(nodes, resourceReviewCopy("en").withdraw);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    harness.cleanups = [];
    confirmAction.mockResolvedValue(true);
    vi.stubGlobal("fetch", harness.fetch);
    harness.fetch.mockResolvedValue(response({}));
  });

  afterEach(() => {
    for (const cleanup of harness.cleanups) cleanup();
    vi.unstubAllGlobals();
  });

  return { render, withdrawButton, copy: () => resourceReviewCopy("en") };
}
