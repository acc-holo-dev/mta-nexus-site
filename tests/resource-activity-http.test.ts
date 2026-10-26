import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { AppError, ForbiddenError, NotFoundError } from "@nexus/domain";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import { resourceActivityCsv } from "../apps/web/src/lib/resource-activity-csv";
import {
  parseAcquisitionHistoryQuery,
  parseResourceActivityQuery,
} from "../apps/web/src/lib/resource-activity-query";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as null | { id: string; role: "user" },
  allowed: true,
  history: vi.fn(),
  report: vi.fn(),
  authorize: vi.fn(),
  download: vi.fn(),
  claim: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/services/resource-activity-service", () => ({
  resourceActivityService: { buyerHistory: state.history, publisherReport: state.report },
}));
vi.mock("../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: { checkEntitlement: async () => true, claimFreeResource: state.claim },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { canManageProduct: async () => false },
}));
vi.mock("@nexus/security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nexus/security")>()),
  consumeRateLimit: vi.fn(async () => ({ success: state.allowed })),
}));
const build = {
  id: "bld_a",
  productId: "prd_a",
  version: "1.0.0",
  status: "published",
  scanStatus: "clean",
  scanner: "scanner",
  scannedAt: new Date(),
  storageKey: "private.zip",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 4,
  fileName: "resource.zip",
  mimeType: "application/zip",
};
vi.mock("@nexus/db", () => ({
  resourceDownloadAuthorizationRepository: { authorize: state.authorize },
  productRepository: {
    findById: async () => ({ id: "prd_a", slug: "resource", status: "published" }),
  },
  buildRepository: { findLatestPublishedByProduct: async () => build },
}));
vi.mock("@nexus/storage", () => ({ storageService: { getDownloadStream: state.download } }));
import { GET as history } from "../apps/web/src/app/api/acquisitions/route";
import { GET as report } from "../apps/web/src/app/api/products/[id]/activity/route";
import { GET as csv } from "../apps/web/src/app/api/products/[id]/activity/export/route";
import { GET as download } from "../apps/web/src/app/api/products/[id]/download/route";
import { POST as claim } from "../apps/web/src/app/api/resources/claim/route";

const context = { params: Promise.resolve({ id: "prd_a" }) };
const activity = {
  product: { id: "prd_a", title: "=PRIVATE-TITLE", status: "published" },
  days: 7 as const,
  from: new Date(),
  through: new Date(),
  acquisitions: 1,
  direct: 1,
  cart: 0,
  retainedGrants: 1,
  downloadStarts: 2,
  timeline: [{ day: "2026-10-10", acquisitions: 1, downloadStarts: 2 }],
};
function request(path: string) {
  return new NextRequest(`https://nexus.test${path}`);
}
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "user" };
  state.allowed = true;
  state.history.mockReset().mockResolvedValue({ items: [], page: 1 });
  state.report.mockReset().mockResolvedValue(activity);
  state.authorize.mockReset().mockResolvedValue({ slug: "resource" });
  state.download.mockReset();
  state.claim.mockReset();
});

it.each([
  history,
  (req: NextRequest) => report(req, context),
  (req: NextRequest) => csv(req, context),
])("requires a session for private activity APIs", async (route) => {
  state.user = null;
  const response = await route(request("/api/acquisitions"));
  expect(response.status).toBe(401);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(state.history).not.toHaveBeenCalled();
  expect(state.report).not.toHaveBeenCalled();
});
it("passes only the session buyer and validated history filters", async () => {
  const response = await history(request("/api/acquisitions?source=cart&page=2"));
  expect(response.status).toBe(200);
  expect(state.history).toHaveBeenCalledWith(state.user, 2, "cart");
  expect(response.headers.get("Vary")).toBe("Cookie");
});
it.each(["?days=8", "?days=7&days=30", "?days=07", "?buyerId=someone"])(
  "rejects invalid activity parameters %s",
  async (query) => {
    expect((await report(request(`/api/products/prd_a/activity${query}`), context)).status).toBe(
      400,
    );
    expect(state.report).not.toHaveBeenCalled();
  },
);
it("does not bypass read rate limits for exports", async () => {
  state.allowed = false;
  expect((await csv(request("/api/products/prd_a/activity/export?days=7"), context)).status).toBe(
    429,
  );
  expect(state.report).not.toHaveBeenCalled();
});
it("exports only authorized daily aggregates with private attachment headers", async () => {
  const response = await csv(request("/api/products/prd_a/activity/export?days=7"), context);
  expect(state.report).toHaveBeenCalledWith(state.user, "prd_a", 7);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(response.headers.get("Content-Disposition")).toBe(
    'attachment; filename="resource-activity-7days.csv"',
  );
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(await response.text()).toBe(
    "utc_day,free_acquisitions,download_starts\r\n2026-10-10,1,2\r\n",
  );
});
it("does not export data after current publisher authorization is denied", async () => {
  state.report.mockRejectedValue(new NotFoundError("Resource", "prd_a"));
  const response = await csv(request("/api/products/prd_a/activity/export"), context);
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});
it.each([
  new ForbiddenError("Access revoked"),
  new AppError("Evidence changed", 409, "BUILD_STATE_CHANGED"),
])("closes opened bytes when final authorization fails", async (error) => {
  const stream = Readable.from("data");
  state.download.mockResolvedValue({
    stream,
    meta: { sizeBytes: 4, sha256Hash: build.sha256Hash },
  });
  state.authorize.mockRejectedValue(error);
  const response = await download(request("/api/products/prd_a/download"), context);
  expect(response.status).toBe(error.statusCode);
  expect(stream.destroyed).toBe(true);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ code: error.code });
});
it("returns preserved license access without a fabricated entitlement", async () => {
  state.claim.mockResolvedValue({
    entitlement: null,
    alreadyClaimed: true,
    accessSource: "license",
    license: { productId: "prd_a", expiresAt: new Date("2026-11-01T00:00:00Z") },
  });
  const response = await claim(
    new NextRequest("https://nexus.test/api/resources/claim", {
      method: "POST",
      headers: { ...browserMutationHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ productId: "prd_a" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    entitlement: null,
    alreadyClaimed: true,
    accessSource: "license",
    license: { productId: "prd_a", expiresAt: "2026-11-01T00:00:00.000Z" },
  });
});
it.each([
  [{ "content-type": "text/plain" }, JSON.stringify({ productId: "prd_a" }), 415],
  [
    { "content-type": "application/json", "sec-fetch-site": "cross-site" },
    JSON.stringify({ productId: "prd_a" }),
    403,
  ],
  [
    { "content-type": "application/json" },
    JSON.stringify({ productId: "prd_a", padding: "x".repeat(3000) }),
    413,
  ],
] as const)("guards single claims before business mutations", async (headers, body, status) => {
  const response = await claim(
    new NextRequest("https://nexus.test/api/resources/claim", {
      method: "POST",
      headers: { ...browserMutationHeaders(), ...headers },
      body,
    }),
  );
  expect(response.status).toBe(status);
  expect(state.claim).not.toHaveBeenCalled();
});
it("rejects injected CSV rows and unsupported or repeated query values", () => {
  expect(() =>
    resourceActivityCsv({
      ...activity,
      timeline: [{ day: "=PRIVATE()", acquisitions: 1, downloadStarts: 2 }],
    }),
  ).toThrow();
  expect(() => parseResourceActivityQuery(new URLSearchParams("days=7&days=30"))).toThrow();
  expect(() => parseAcquisitionHistoryQuery(new URLSearchParams("source=other"))).toThrow();
  expect(() => parseAcquisitionHistoryQuery(new URLSearchParams("page=-1"))).toThrow();
  expect(() => parseAcquisitionHistoryQuery(new URLSearchParams("page=2&page=3"))).toThrow();
});
