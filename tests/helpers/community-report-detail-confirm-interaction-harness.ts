import type { ReactNode } from "react";
import { afterEach, beforeEach, type Mock, vi } from "vitest";
import type { CommunityReportDetail } from "../../site/src/lib/community-report-contract";
import { communityReportCopy } from "../../site/src/lib/community-report-copy";
import {
  type FlatTestElement,
  findTestButton,
  flattenReactTestTree,
} from "./flatten-react-test-tree";

type CommunityReportDetailConfirmHarness = {
  slots: unknown[];
  cursor: number;
  request: Mock;
};

/** Props match the fixture literals so real CommunityReportDetailView stays assignable. */
type CommunityReportDetailViewComponent = (props: {
  id: typeof reportId;
  initial: typeof detail;
  locale: "en";
  staff: true;
}) => ReactNode;

type Element = FlatTestElement;

const reportId = "rep_aaaaaaaaaaaaaaaaaaaaaaaa";
export const notes = "Reviewed evidence carefully";
const detail: CommunityReportDetail = {
  id: reportId,
  targetType: "comment",
  targetId: "cmt_aaaaaaaaaaaaaaaaaaaaaaaa",
  type: "abuse",
  reason: "Harassment in the discussion thread.",
  evidenceUrls: ["https://evidence.test/thread"],
  status: "open",
  createdAt: "2026-10-10T00:00:00.000Z",
  resolvedAt: null,
  target: {
    kind: "comment",
    title: "Thread title",
    text: "Reported comment body",
    truncated: false,
    author: "author",
    status: "published",
    href: "/articles/title#comment-cmt_aaaaaaaaaaaaaaaaaaaaaaaa",
    revision: "a".repeat(64),
  },
  moderationHref: "/admin/community/guide/discussion/cmt_aaaaaaaaaaaaaaaaaaaaaaaa",
  moderatorNotes: null,
  reporterId: "usr_reporter",
};

/** Shared react mock factory for community-report-detail confirm suites. */
export function mockReactHooks(harness: CommunityReportDetailConfirmHarness) {
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
    useEffect: () => {
      // Confirm-cancel coverage seeds slots; skip abort-controller cleanup effect.
    },
  });
}

function seedAwaitingDecisionSlots(harness: CommunityReportDetailConfirmHarness) {
  // report, notes, pending, error, confirmation, success, needsReload, guard, controller
  harness.slots = [
    detail,
    notes,
    false,
    "",
    {
      action: "resolve",
      notes,
      expectedStatus: "open",
    },
    "",
    false,
    { current: false },
    { current: null },
  ];
}

export function createCommunityReportDetailConfirmInteractionHelpers(
  harness: CommunityReportDetailConfirmHarness,
  CommunityReportDetailView: CommunityReportDetailViewComponent,
) {
  function seedAwaitingDecision() {
    seedAwaitingDecisionSlots(harness);
  }

  function render() {
    harness.cursor = 0;
    return flattenReactTestTree(
      CommunityReportDetailView({
        id: reportId,
        initial: detail,
        locale: "en",
        staff: true,
      }),
    );
  }

  function clickCancel(nodes: Element[]) {
    (findTestButton(nodes, communityReportCopy("en").cancel).props.onClick as () => void)();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    harness.cursor = 0;
    seedAwaitingDecision();
    harness.request.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  return {
    render,
    clickCancel,
  };
}
