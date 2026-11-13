import type { OrderCaseReviewStatus, SupportCaseStatus } from "@nexus/domain";
import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import { flattenReactTestTree } from "./flatten-react-test-tree";

type OrderCaseReviewActorHarness = {
  slots: unknown[];
  cursor: number;
  actor: string;
  fetch: Mock;
  refresh: Mock;
};

/** Props match OrderCaseReviewForm so the real component stays assignable. */
type OrderCaseReviewFormComponent = (props: {
  actorId: string;
  caseId: string;
  reviewStatus: OrderCaseReviewStatus;
  revision: number;
  supportUpdatedAt: string;
  evidenceHash: string;
  threadStatus: SupportCaseStatus;
  canRecommendRefund: boolean;
  monetary: boolean;
  recommendationEligible: boolean;
  locale: string;
}) => ReactNode;

/** Shared react mock factory for order-case-review actor suites (use with vi.mock("react", ...)). */
export function mockReactHooks(harness: OrderCaseReviewActorHarness) {
  return async (original: () => Promise<typeof import("react")>) => ({
    ...(await original()),
    useState: (initial: unknown) => {
      const i = harness.cursor++;
      if (!(i in harness.slots)) harness.slots[i] = initial;
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
    useEffect: () => {},
  });
}

export function reviewReceipt(actorId: string) {
  return {
    actorId,
    kind: "order_case_reviewed",
    caseId: "sup_a",
    action: "start_review",
    reviewStatus: "reviewing",
    revision: 2,
    threadStatus: "open",
    supportUpdatedAt: "2026-10-11T00:00:00.001Z",
    financialExecution: false,
  };
}

export function createOrderCaseReviewActorInteractionHelpers(
  harness: OrderCaseReviewActorHarness,
  OrderCaseReviewForm: OrderCaseReviewFormComponent,
) {
  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      OrderCaseReviewForm({
        actorId: harness.actor,
        caseId: "sup_a",
        reviewStatus: "intake",
        revision: 1,
        supportUpdatedAt: "2026-10-11T00:00:00.000Z",
        evidenceHash: "a".repeat(64),
        threadStatus: "open",
        canRecommendRefund: false,
        monetary: false,
        recommendationEligible: false,
        locale: "en",
      }) as ReactNode,
    );
  }

  function prepare() {
    const notes = render().find((n) => n.type === "textarea");
    if (!notes) throw Error("Missing notes");
    (notes.props.onChange as (e: unknown) => void)({ target: { value: "Reviewed records" } });
  }

  function review() {
    const button = render().find((n) => n.type === "button" && n.props.children === "Start review");
    if (!button) throw Error("Missing review");
    (button.props.onClick as () => void)();
  }

  beforeEach(() => {
    harness.slots = [];
    harness.actor = "usr_a";
    harness.fetch.mockReset();
    harness.refresh.mockReset();
    vi.stubGlobal("fetch", harness.fetch);
  });

  afterEach(() => vi.unstubAllGlobals());

  return { render, prepare, review };
}
