import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminBuildDownloadApiCopy } from "../../src/features/resources/admin-build-download-api-copy";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  can: vi.fn(),
  rate: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/security", () => ({
  can: mocks.can,
  consumeRateLimit: mocks.rate,
  generateId: vi.fn(() => "aud_1"),
}));

vi.mock("@nexus/db", () => ({
  buildRepository: {
    findById: mocks.findById,
  },
  buildReviewDownloadRepository: {},
}));

import { GET } from "../../src/app/api/admin/builds/[buildId]/download/route";

function request(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/admin/builds/bld_1/download", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

describe("admin build download API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ id: "usr_mod", role: "moderator" });
    mocks.can.mockReturnValue(true);
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual moderator and scan-provenance errors from nexus_locale", async () => {
    mocks.can.mockReturnValueOnce(false);
    const forbidden = await GET(request("ru"), {
      params: Promise.resolve({ buildId: "bld_1" }),
    });
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toMatchObject({
      error: adminBuildDownloadApiCopy("ru").moderatorRequired,
    });

    mocks.findById.mockResolvedValueOnce({
      id: "bld_1",
      status: "pending_review",
      scanStatus: "malicious",
      scanner: "clamav",
      scannedAt: new Date(),
    });
    const scan = await GET(request("en"), {
      params: Promise.resolve({ buildId: "bld_1" }),
    });
    expect(scan.status).toBe(422);
    expect(await scan.json()).toMatchObject({
      error: adminBuildDownloadApiCopy("en").scanProvenanceRequired,
    });
  });
});
