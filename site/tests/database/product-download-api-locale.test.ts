import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { productDownloadApiCopy } from "../../src/features/resources/product-download-api-copy";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rate: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("../../src/lib/services/commerce/product-service", () => ({
  productService: {
    getProductById: mocks.findById,
    canManageProduct: vi.fn(),
    findPublishedBuildByProductAndId: vi.fn(),
    findLatestPublishedBuildByProduct: vi.fn(),
    authorizeResourceDownload: vi.fn(),
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  generateId: vi.fn(),
}));

vi.mock("@nexus/storage", () => ({
  storageService: {
    getDownloadStream: vi.fn(),
  },
}));

import { GET } from "../../src/app/api/products/[id]/download/route";

const params = Promise.resolve({ id: "prd_dl" });

function getRequest(locale: "en" | "ru", withSession = true) {
  const cookie = withSession
    ? `nexus_session=tok;nexus_locale=${locale}`
    : `nexus_locale=${locale}`;
  return new NextRequest("https://nexus.test/api/products/prd_dl/download", {
    headers: { cookie },
  });
}

describe("product download API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ id: "usr_dl", role: "user" });
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual auth error from nexus_locale", async () => {
    const unauth = await GET(getRequest("ru", false), { params });
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: productDownloadApiCopy("ru").authenticationRequired,
    });
  });

  it("returns bilingual not-found from nexus_locale", async () => {
    mocks.findById.mockResolvedValueOnce(null);
    const missing = await GET(getRequest("en"), { params });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({
      error: productDownloadApiCopy("en").notFound,
    });
  });
});
