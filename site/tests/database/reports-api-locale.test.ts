import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reportsApiCopy } from "../../src/features/moderation/reports-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  can: vi.fn(),
  rate: vi.fn(),
  generateId: vi.fn(),
  listPage: vi.fn(),
  createWithAudit: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/security", () => ({
  can: mocks.can,
  consumeRateLimit: mocks.rate,
  generateId: mocks.generateId,
}));

vi.mock("@nexus/db", () => ({
  reportRepository: {
    listPage: mocks.listPage,
    createWithAudit: mocks.createWithAudit,
  },
}));

import { GET, POST } from "../../src/app/api/reports/route";

function getRequest(locale: "en" | "ru", query = "") {
  return new NextRequest(`https://nexus.test/api/reports${query}`, {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

function postRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/reports", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("reports API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_rpt" });
    mocks.can.mockReturnValue(false);
    mocks.rate.mockResolvedValue({ success: true });
    mocks.generateId.mockReturnValue("rpt_x");
  });

  it("returns bilingual GET unauthorized and invalid page from nexus_locale", async () => {
    const unauthorized = await GET(getRequest("ru"));
    expect(unauthorized.status).toBe(403);
    expect(await unauthorized.json()).toMatchObject({
      error: reportsApiCopy("ru").unauthorized,
    });

    mocks.can.mockReturnValue(true);
    const invalid = await GET(getRequest("en", "?page=0&view=pending"));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: reportsApiCopy("en").invalidPageOrView,
    });
  });

  it("returns bilingual POST auth and self-report errors from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await POST(
      postRequest("ru", {
        targetType: "user",
        targetId: "usr_other",
        type: "abuse",
        reason: "A long enough reason",
      }),
    );
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: reportsApiCopy("ru").authenticationRequired,
    });

    const self = await POST(
      postRequest("en", {
        targetType: "user",
        targetId: "usr_rpt",
        type: "abuse",
        reason: "A long enough reason",
      }),
    );
    expect(self.status).toBe(422);
    expect(await self.json()).toMatchObject({
      error: reportsApiCopy("en").cannotReportSelf,
    });
    expect(mocks.createWithAudit).not.toHaveBeenCalled();
  });
});
