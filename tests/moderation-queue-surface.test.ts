import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    username: string;
    displayName: string;
    role: string;
  },
}));

const mocks = vi.hoisted(() => ({
  listPendingReviewPage: vi.fn(),
  countPendingReview: vi.fn(),
  listRiskReviewPage: vi.fn(),
  countQuarantined: vi.fn(),
  listDraftPage: vi.fn(),
  countDrafts: vi.fn(),
  listVerificationPage: vi.fn(),
  countPendingVerification: vi.fn(),
  listReports: vi.fn(),
  health: vi.fn(),
  can: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => ({ value: "test-session" })),
  })),
}));

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
  },
}));

vi.mock("@nexus/security", () => ({
  can: mocks.can,
}));

vi.mock("@nexus/db", () => ({
  buildRepository: {
    listPendingReviewPage: mocks.listPendingReviewPage,
    countPendingReview: mocks.countPendingReview,
    listRiskReviewPage: mocks.listRiskReviewPage,
    countQuarantined: mocks.countQuarantined,
  },
  contentRepository: {
    listDraftPage: mocks.listDraftPage,
    countDrafts: mocks.countDrafts,
  },
  verificationRepository: {
    listPage: mocks.listVerificationPage,
    countPending: mocks.countPendingVerification,
  },
}));

vi.mock("../apps/web/src/lib/services/admin-service", () => ({
  adminService: {
    getSystemHealthMetrics: mocks.health,
    listReports: mocks.listReports,
    listAuditLogs: vi.fn(async () => []),
  },
}));

import AdminPage from "../apps/web/src/app/admin/page";

describe("moderation queue admin boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = null;
    mocks.can.mockImplementation(
      (_user: unknown, action: string) =>
        action === "admin.access",
    );
    mocks.health.mockResolvedValue({
      counts: {
        users: 10,
        servers: 3,
        products: 4,
        publishedContent: 2,
        reportsOpen: 0,
      },
    });
    mocks.listReports.mockResolvedValue({
      reports: [],
      hasMore: false,
    });
    mocks.listVerificationPage.mockResolvedValue({
      requests: [],
      hasMore: false,
    });
    mocks.countPendingVerification.mockResolvedValue(0);
    mocks.listPendingReviewPage.mockResolvedValue({
      builds: [],
      hasMore: false,
    });
    mocks.countPendingReview.mockResolvedValue(7);
    mocks.listRiskReviewPage.mockResolvedValue({
      builds: [],
      hasMore: false,
    });
    mocks.countQuarantined.mockResolvedValue(0);
    mocks.listDraftPage.mockResolvedValue({
      items: [],
      hasMore: false,
    });
    mocks.countDrafts.mockResolvedValue(0);
  });

  it("returns access-denied UI before reading moderation queues", async () => {
    state.user = {
      id: "usr_member",
      username: "member",
      displayName: "Member",
      role: "user",
    };
    mocks.can.mockReturnValue(false);

    const markup = renderToStaticMarkup(
      await AdminPage({ searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain(
      getDictionary("en").admin.accessDenied,
    );
    expect(mocks.listPendingReviewPage).not.toHaveBeenCalled();
    expect(mocks.countPendingReview).not.toHaveBeenCalled();
    expect(mocks.listVerificationPage).not.toHaveBeenCalled();
    expect(mocks.listReports).not.toHaveBeenCalled();
  });

  it("loads the paginated pending-build queue only after admin authorization", async () => {
    state.user = {
      id: "usr_admin",
      username: "admin",
      displayName: "Admin",
      role: "admin",
    };

    const markup = renderToStaticMarkup(
      await AdminPage({
        searchParams: Promise.resolve({
          buildPage: "3",
        }),
      }),
    );
    const copy = getDictionary("en").admin;

    expect(mocks.can).toHaveBeenCalledWith(
      state.user,
      "admin.access",
    );
    expect(mocks.listPendingReviewPage).toHaveBeenCalledWith(3);
    expect(mocks.countPendingReview).toHaveBeenCalledOnce();
    expect(markup).toContain(copy.resourceBuildQueue);
    expect(markup).toContain(
      `7 ${copy.buildsAwaitingReview}`,
    );
    expect(markup).toContain(copy.noBuilds);
    expect(markup).toContain(`${copy.reportPage} 3`);
  });

  it("normalizes invalid build page input before repository access", async () => {
    state.user = {
      id: "usr_admin",
      username: "admin",
      displayName: "Admin",
      role: "admin",
    };

    await AdminPage({
      searchParams: Promise.resolve({
        buildPage: "0",
      }),
    });
    expect(mocks.listPendingReviewPage).toHaveBeenCalledWith(1);

    vi.clearAllMocks();
    mocks.can.mockImplementation(
      (_user: unknown, action: string) =>
        action === "admin.access",
    );
    mocks.health.mockResolvedValue({
      counts: {
        users: 0,
        servers: 0,
        products: 0,
        publishedContent: 0,
        reportsOpen: 0,
      },
    });
    mocks.listReports.mockResolvedValue({
      reports: [],
      hasMore: false,
    });
    mocks.listVerificationPage.mockResolvedValue({
      requests: [],
      hasMore: false,
    });
    mocks.countPendingVerification.mockResolvedValue(0);
    mocks.listPendingReviewPage.mockResolvedValue({
      builds: [],
      hasMore: false,
    });
    mocks.countPendingReview.mockResolvedValue(0);
    mocks.listRiskReviewPage.mockResolvedValue({
      builds: [],
      hasMore: false,
    });
    mocks.countQuarantined.mockResolvedValue(0);
    mocks.listDraftPage.mockResolvedValue({
      items: [],
      hasMore: false,
    });
    mocks.countDrafts.mockResolvedValue(0);

    await AdminPage({
      searchParams: Promise.resolve({
        buildPage: "999999",
      }),
    });
    expect(mocks.listPendingReviewPage).toHaveBeenCalledWith(1);
  });
});
