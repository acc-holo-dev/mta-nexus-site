import { beforeEach, type Mock, vi } from "vitest";

type ResourceReviewPagesState = {
  actor: { id: string; role: string } | null;
  locale: "en" | "ru";
};

type ResourceReviewPagesMocks = {
  ownPage: Mock;
  ownDetail: Mock;
  publicPage: Mock;
  reportsPage: Mock;
  reportDetail: Mock;
};

/** Shared actor/locale fixture for resource-review page suites. */
export const state: ResourceReviewPagesState = {
  actor: { id: "usr_a", role: "user" },
  locale: "en",
};

/** Shared repository mocks for resource-review page suites. */
export const mocks: ResourceReviewPagesMocks = {
  ownPage: vi.fn(),
  ownDetail: vi.fn(),
  publicPage: vi.fn(),
  reportsPage: vi.fn(),
  reportDetail: vi.fn(),
};

const now = new Date("2026-10-11T00:00:00Z");
const bounds = { page: 2, totalPages: 3, total: 41 };
export const review = {
  id: "cmt_a",
  text: "<script>private review</script>",
  rating: 3,
  status: "published" as const,
  revision: 2,
  accessSource: "legacy" as const,
  createdAt: now,
  updatedAt: null,
  author: { username: "alice", displayName: "Alice" },
};

function resetResourceReviewPagesState() {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  mocks.ownPage.mockReset().mockResolvedValue({
    items: [{ ...review, productId: "prd_a", title: null, slug: null }],
    ...bounds,
  });
  mocks.ownDetail.mockReset().mockResolvedValue({
    product: { id: "prd_a", title: null, slug: null },
    review,
    canReview: false,
    eligibility: "access_required",
  });
  mocks.publicPage.mockReset().mockResolvedValue({ reviews: [review], ...bounds });
  mocks.reportsPage.mockReset().mockResolvedValue({
    items: [{ id: "rpt_a", reason: "<Complaint>", status: "open" }],
    view: "history",
    ...bounds,
  });
  mocks.reportDetail.mockReset().mockResolvedValue({
    id: "rpt_a",
    reason: "<Complaint>",
    status: "open",
    moderatorNotes: "INTERNAL_STAFF_NOTE",
    review: null,
  });
}

/** Register default mock reset for resource-review page suites. */
export function setupResourceReviewPages() {
  beforeEach(resetResourceReviewPagesState);
}
