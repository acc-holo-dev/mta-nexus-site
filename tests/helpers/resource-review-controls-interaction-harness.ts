import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { flattenReactTestTree, type FlatTestElement } from "./flatten-react-test-tree";

type ResourceReviewControlsHarness = {
  slots: unknown[];
  cursor: number;
  fetch: Mock;
};

type Element = FlatTestElement;

/** Exact fixture literals so real editor props stay assignable under strictFunctionTypes. */
export const productId = "prd_a";
export const reportId = "rpt_a";

export const originalReview = {
  text: "Original review",
  rating: 4,
  status: "published",
  revision: 2,
};

export const savedReview = {
  text: "Saved draft",
  rating: 4,
  status: "published",
  revision: 3,
};

export const publishedReview = {
  text: "Published review",
  rating: 4,
  status: "published",
  revision: 2,
};

export const withdrawnReview = {
  text: "Published review",
  rating: 4,
  status: "withdrawn",
  revision: 2,
};

export const latestReview = {
  text: "Changed elsewhere",
  rating: 3,
  status: "published",
  revision: 3,
};

type ReviewFixture =
  | typeof originalReview
  | typeof savedReview
  | typeof publishedReview
  | typeof withdrawnReview
  | typeof latestReview;

/** Decision actions exercised by the suites; subtype of ResourceReviewDecisionAction. */
type DecisionAction = "remove_review" | "dismiss";

type ResourceReviewEditorComponent = (props: {
  productId: typeof productId;
  review: ReviewFixture;
  canReview: boolean;
  locale: "en" | "ru";
}) => ReactNode;

type ResourceReviewDecisionFormComponent = (props: {
  id: typeof reportId;
  status: "open";
  revision: 2;
  reviewText: "Reported review body";
  locale: "en" | "ru";
}) => ReactNode;

type ConfirmActionMock = Mock<(...args: unknown[]) => Promise<boolean>>;

export const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Shared react mock factory for resource-review-controls suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: ResourceReviewControlsHarness) {
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
  });
}

export function createResourceReviewControlsInteractionHelpers(
  harness: ResourceReviewControlsHarness,
  ResourceReviewDecisionForm: ResourceReviewDecisionFormComponent,
  ResourceReviewEditor: ResourceReviewEditorComponent,
  confirmAction: ConfirmActionMock,
) {
  function renderDecision(locale: "en" | "ru" = "en", action: DecisionAction = "remove_review") {
    // notes, action, busy, message, confirmed
    harness.slots = ["Reviewed reason", action, false, "", false];
    harness.cursor = 0;
    return flattenReactTestTree(
      ResourceReviewDecisionForm({
        id: reportId,
        status: "open",
        revision: 2,
        reviewText: "Reported review body",
        locale,
      }),
    );
  }

  function renderEditor(review: ReviewFixture, locale: "en" | "ru" = "en", canReview = true) {
    harness.cursor = 0;
    return flattenReactTestTree(ResourceReviewEditor({ productId, review, canReview, locale }));
  }

  function submit(nodes: Element[]) {
    const form = nodes.find((node) => node.type === "form");
    if (!form) throw new Error("Missing decision form");
    (form.props.onSubmit as (event: { preventDefault: () => void }) => void)({
      preventDefault() {},
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.slots = [];
    harness.cursor = 0;
    confirmAction.mockReset().mockResolvedValue(true);
    harness.fetch
      .mockReset()
      .mockResolvedValue(response({ id: reportId, status: "resolved", reviewRemoved: true }));
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return { renderDecision, renderEditor, submit };
}
