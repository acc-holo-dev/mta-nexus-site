import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { platformReportsApiCopy } from "../../src/features/moderation/platform-reports-api-copy";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listForReporter: vi.fn(),
  detailForReporter: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("../../src/lib/services/moderation/platform-report-service", () => ({
  platformReportService: {
    listForReporter: mocks.listForReporter,
    detailForReporter: mocks.detailForReporter,
  },
}));

import { GET as getDetail } from "../../src/app/api/workspace/platform-reports/[id]/route";
import { GET as getList } from "../../src/app/api/workspace/platform-reports/route";

function listRequest(locale: "en" | "ru", query = "") {
  return new NextRequest(`https://nexus.test/api/workspace/platform-reports${query}`, {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

function detailRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/workspace/platform-reports/pr_a", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

describe("platform reports API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ id: "usr_pr" });
  });

  it("returns bilingual list unauthorized and invalid page from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await getList(listRequest("ru"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: platformReportsApiCopy("ru").unauthorized,
    });

    const invalid = await getList(listRequest("en", "?page=0"));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: platformReportsApiCopy("en").invalidPage,
    });
    expect(mocks.listForReporter).not.toHaveBeenCalled();
  });

  it("returns bilingual detail not-found from nexus_locale", async () => {
    mocks.detailForReporter.mockResolvedValueOnce(null);
    const missing = await getDetail(detailRequest("ru"), {
      params: Promise.resolve({ id: "pr_a" }),
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      error: platformReportsApiCopy("ru").notFound,
    });
  });
});
