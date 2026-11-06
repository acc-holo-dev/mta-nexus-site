import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";

/** Shared mock state for resource-management HTTP suites. */
export const resourceManagementHttpState = {
  user: { id: "usr_a", role: "developer" } as null | {
    id: string;
    role: "developer" | "moderator";
  },
  allowed: true,
  command: vi.fn(),
  managed: vi.fn(),
  candidates: vi.fn(),
  compatibility: vi.fn(),
  authorize: vi.fn(),
  download: vi.fn(),
  findBuild: vi.fn(),
  findManagedProduct: vi.fn(),
};

/** Factory for `vi.mock("@nexus/db", …)` from suite files under `tests/`. */
export function createResourceManagementHttpDbMock() {
  const state = resourceManagementHttpState;
  return {
    resourceVariantsRepository: {
      command: state.command,
      managed: state.managed,
      candidates: state.candidates,
    },
    resourceCompatibilityRepository: { update: state.compatibility },
    buildReviewDownloadRepository: { authorize: state.authorize },
    buildRepository: { findById: state.findBuild },
  };
}

/** Factory for `vi.mock("@nexus/security", …)` from suite files under `tests/`. */
export async function createResourceManagementHttpSecurityMock(
  importOriginal: () => Promise<typeof import("@nexus/security")>,
) {
  return {
    ...(await importOriginal()),
    consumeRateLimit: vi.fn(async () => ({
      success: resourceManagementHttpState.allowed,
    })),
  };
}

/** Factory for `vi.mock("@nexus/storage", …)` from suite files under `tests/`. */
export function createResourceManagementHttpStorageMock() {
  return {
    storageService: { getDownloadStream: resourceManagementHttpState.download },
  };
}

/** Factory for auth-service mock from suite files under `tests/`. */
export function createResourceManagementHttpAuthMock() {
  return {
    authService: { getSession: async () => resourceManagementHttpState.user },
  };
}

/** Factory for product-service mock from suite files under `tests/`. */
export function createResourceManagementHttpProductMock() {
  return {
    productService: {
      getManagedProduct: resourceManagementHttpState.findManagedProduct,
    },
  };
}

export const resourceManagementHttpContext = {
  params: Promise.resolve({ id: "prd_a" }),
};
export const resourceManagementHttpRevision = "2026-10-10T00:00:00.000Z";
export const resourceManagementHttpCommand = {
  action: "save",
  expectedGroupId: null,
  expectedRevision: 0,
  title: "Resource variants",
  variants: [{ productId: "prd_a", label: "Base" }],
  reason: "Group the resources",
};

export function resourceManagementHttpRequest(
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(
    `https://nexus.test${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          body: JSON.stringify(body),
          headers: {
            ...browserMutationHeaders(),
            "content-type": "application/json",
            ...(path.includes("/compatibility") || path.endsWith("/variants")
              ? { "x-nexus-actor-id": "usr_a" }
              : {}),
            ...headers,
          },
        },
  );
}

export function resetResourceManagementHttpState() {
  resourceManagementHttpState.user = { id: "usr_a", role: "developer" };
  resourceManagementHttpState.allowed = true;
  for (const mock of [
    resourceManagementHttpState.command,
    resourceManagementHttpState.managed,
    resourceManagementHttpState.candidates,
    resourceManagementHttpState.compatibility,
    resourceManagementHttpState.authorize,
    resourceManagementHttpState.download,
    resourceManagementHttpState.findBuild,
    resourceManagementHttpState.findManagedProduct,
  ])
    mock.mockReset();
}

export function installResourceManagementHttpHooks() {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    resetResourceManagementHttpState();
  });
}

export function resourceManagementHttpReviewFixture() {
  const state = resourceManagementHttpState;
  state.user = { id: "usr_mod", role: "moderator" };
  const build = {
    id: "bld_a",
    productId: "prd_a",
    version: "1.0.0",
    status: "pending_review",
    scanStatus: "clean",
    scanner: "scanner",
    scannedAt: new Date(resourceManagementHttpRevision),
    storageKey: "private/file.zip",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 4,
    fileName: "file.zip",
    mimeType: "application/zip",
  };
  const stream = Readable.from(Buffer.from("data"));
  state.findBuild.mockResolvedValue(build);
  state.download.mockResolvedValue({
    stream,
    meta: { sizeBytes: 4, sha256Hash: build.sha256Hash },
  });
  return { build, stream, context: { params: Promise.resolve({ buildId: "bld_a" }) } };
}
