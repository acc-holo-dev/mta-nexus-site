import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { beforeEach, vi } from "vitest";

/** Shared mutable fixtures for resource-download HTTP concern suites. */
/** Shared fixtures for resource-download-http suite splits. */
export const resourceDownloadHttpState = {
  user: null as null | {
    id: string;
    email: string;
    username: string;
    displayName: string;
    role: "user" | "developer" | "admin";
  },
  product: null as null | {
    id: string;
    slug: string;
    authorId: string;
    status: "published" | "draft" | "suspended" | "archived";
  },
  entitled: false,
  managementAccess: false,
  build: null as null | {
    id: string;
    productId: string;
    version: string;
    status: "published";
    scanStatus: "not_scanned" | "clean" | "malicious" | "error";
    scanner?: string;
    scannedAt?: Date;
    storageKey: string;
    sha256Hash: string;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
  },
};

export const resourceDownloadHttpAuditRecord = vi.fn(async (_input?: unknown) => undefined);
export const resourceDownloadHttpDeliveryFinish = vi.fn(async (_input?: unknown) => null);
export const resourceDownloadHttpDownloadStream = vi.fn();
export const resourceDownloadHttpFindLatestPublishedBuild = vi.fn();
export const resourceDownloadHttpFindPinnedPublishedBuild = vi.fn();

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/unit` or `tests/database`. */
export function createResourceDownloadHttpDbMock() {
  return {
    productRepository: {
      findById: vi.fn(async () => resourceDownloadHttpState.product),
    },
    buildRepository: {
      findLatestPublishedByProduct: resourceDownloadHttpFindLatestPublishedBuild,
      findPublishedByProductAndId: resourceDownloadHttpFindPinnedPublishedBuild,
    },
    resourceDeliveriesRepository: { finish: resourceDownloadHttpDeliveryFinish },
    auditRepository: {
      record: resourceDownloadHttpAuditRecord,
    },
    resourceDownloadAuthorizationRepository: {
      authorize: async (input: unknown) => {
        await resourceDownloadHttpAuditRecord(input);
        return {
          slug: resourceDownloadHttpState.product?.slug ?? "http-resource",
          receiptId: "dlv_http",
        };
      },
    },
  };
}

export const resourceDownloadHttpContext = {
  params: Promise.resolve({ id: "prd_http" }),
};

/** Latest-build download request with the default player session cookie. */
export function resourceDownloadHttpRequest() {
  return new NextRequest("http://nexus.test/api/products/prd_http/download", {
    method: "GET",
    headers: { cookie: "nexus_session=tok_player" },
  });
}

/** Pinned historical download request; default selector is `bld_historical_1`. */
export function resourceDownloadHttpPinnedRequest(query = "?buildId=bld_historical_1") {
  return new NextRequest(`http://nexus.test/api/products/prd_http/download${query}`, {
    headers: { cookie: "nexus_session=tok_player" },
  });
}

function resetCommonPlayerProduct() {
  resourceDownloadHttpState.user = {
    id: "usr_player",
    email: "player@nexus.test",
    username: "player",
    displayName: "Player",
    role: "user",
  };
  resourceDownloadHttpState.product = {
    id: "prd_http",
    slug: "http-resource",
    authorId: "usr_author",
    status: "published",
  };
  resourceDownloadHttpState.entitled = true;
  resourceDownloadHttpState.managementAccess = false;
}

function resetLatestBuildFixture() {
  resourceDownloadHttpState.build = {
    id: "bld_http",
    productId: "prd_http",
    version: "1.2.3",
    status: "published",
    scanStatus: "clean",
    scanner: "test-scanner",
    scannedAt: new Date(),
    storageKey: "assets/http-resource.zip",
    sha256Hash: createHash("sha256").update("nexus-build").digest("hex"),
    fileName: "http-resource.zip",
    fileSizeBytes: Buffer.byteLength("nexus-build"),
    mimeType: "application/zip",
  };
  resourceDownloadHttpFindLatestPublishedBuild.mockImplementation(
    async () => resourceDownloadHttpState.build,
  );
  resourceDownloadHttpFindPinnedPublishedBuild.mockImplementation(
    async (productId: string, buildId: string) =>
      productId === resourceDownloadHttpState.build?.productId &&
      buildId === resourceDownloadHttpState.build?.id
        ? resourceDownloadHttpState.build
        : null,
  );
  resourceDownloadHttpDownloadStream.mockResolvedValue({
    stream: Readable.from(Buffer.from("nexus-build")),
    meta: {
      sizeBytes: Buffer.byteLength("nexus-build"),
      sha256Hash: resourceDownloadHttpState.build?.sha256Hash,
      mimeType: "application/zip",
    },
  });
}

function resetPinnedBuildFixture() {
  resourceDownloadHttpState.build = {
    id: "bld_historical_1",
    productId: "prd_http",
    version: "1.0.0",
    status: "published",
    scanStatus: "clean",
    scanner: "test-scanner",
    scannedAt: new Date(),
    storageKey: "assets/old-resource.zip",
    sha256Hash: createHash("sha256").update("historical").digest("hex"),
    fileName: "historical-resource.zip",
    fileSizeBytes: Buffer.byteLength("historical"),
    mimeType: "application/zip",
  };
  resourceDownloadHttpFindLatestPublishedBuild.mockResolvedValue(null);
  resourceDownloadHttpFindPinnedPublishedBuild.mockImplementation(
    async (productId: string, buildId: string) =>
      productId === "prd_http" && buildId === "bld_historical_1"
        ? resourceDownloadHttpState.build
        : null,
  );
  resourceDownloadHttpDownloadStream.mockResolvedValue({
    stream: Readable.from(Buffer.from("historical")),
    meta: {
      sizeBytes: Buffer.byteLength("historical"),
      sha256Hash: resourceDownloadHttpState.build?.sha256Hash,
      mimeType: "application/zip",
    },
  });
}

function clearResourceDownloadHttpMocks() {
  vi.clearAllMocks();
  resourceDownloadHttpAuditRecord.mockReset();
  resourceDownloadHttpDownloadStream.mockReset();
  resourceDownloadHttpDeliveryFinish.mockReset();
  resourceDownloadHttpFindLatestPublishedBuild.mockReset();
  resourceDownloadHttpFindPinnedPublishedBuild.mockReset();
}

/** Shared latest-build fixture lifecycle for access and delivery suites. */
export function installResourceDownloadHttpLatestLifecycle() {
  beforeEach(() => {
    clearResourceDownloadHttpMocks();
    resetCommonPlayerProduct();
    resetLatestBuildFixture();
  });
}

/** Shared pinned historical-build fixture lifecycle. */
export function installResourceDownloadHttpPinnedLifecycle() {
  beforeEach(() => {
    clearResourceDownloadHttpMocks();
    resetCommonPlayerProduct();
    resetPinnedBuildFixture();
  });
}
