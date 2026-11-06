import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";
import packageFixtures from "../fixtures/build-packages.json";

/** Shared preflight/product mocks for build-upload HTTP suites. */
export const buildUploadPreflightHttpMocks = {
  preflight: vi.fn(),
  releaseBuild: vi.fn(),
  scan: vi.fn(),
  uploadAsset: vi.fn(),
  deleteAsset: vi.fn(),
};

/** Route context for `/api/products/[id]/builds`. */
export const buildUploadPreflightHttpContext = {
  params: Promise.resolve({ id: "prd_target" }),
};

/** Factory for auth-service mock from suite files under `tests/`. */
export function createBuildUploadPreflightHttpAuthMock() {
  return {
    authService: {
      getSession: vi.fn(async () => ({
        id: "usr_attacker",
        email: "attacker@nexus.test",
        username: "attacker",
        displayName: "Attacker",
        role: "user",
      })),
    },
  };
}

/** Factory for product-service mock from suite files under `tests/`. */
export function createBuildUploadPreflightHttpProductMock() {
  return {
    productService: {
      assertCanReleaseBuild: buildUploadPreflightHttpMocks.preflight,
      releaseBuild: buildUploadPreflightHttpMocks.releaseBuild,
    },
  };
}

/** Factory for build-scanner-service mock from suite files under `tests/`. */
export function createBuildUploadPreflightHttpScannerMock() {
  return {
    buildScannerService: { scan: buildUploadPreflightHttpMocks.scan },
  };
}

/** Factory for `@nexus/storage` mock from suite files under `tests/`. */
export function createBuildUploadPreflightHttpStorageMock() {
  return {
    MAX_FILE_SIZE_BYTES: 1024,
    storageService: {
      uploadAsset: buildUploadPreflightHttpMocks.uploadAsset,
      deleteAsset: buildUploadPreflightHttpMocks.deleteAsset,
    },
  };
}

/** Factory for `@nexus/security` mock from suite files under `tests/`. */
export function createBuildUploadPreflightHttpSecurityMock() {
  return {
    consumeRateLimit: vi.fn(async () => ({
      success: true,
      remaining: 9,
      resetAt: new Date(Date.now() + 60_000),
    })),
  };
}

export function installBuildUploadPreflightHttpHooks() {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
  });
}

/** Non-multipart JSON body used for early-reject authorization cases. */
export function buildUploadPreflightHttpInvalidBodyRequest() {
  return new NextRequest("http://nexus.test/api/products/prd_target/builds", {
    method: "POST",
    headers: browserMutationHeaders({
      cookie: "nexus_session=tok_attacker",
      "x-nexus-actor-id": "usr_attacker",
      "content-type": "application/json",
    }),
    body: JSON.stringify({ intentionally: "not multipart" }),
  });
}

/** Declared Content-Length above the upload ceiling. */
export function buildUploadPreflightHttpOversizedDeclaredRequest() {
  return new NextRequest("http://nexus.test/api/products/prd_target/builds", {
    method: "POST",
    headers: browserMutationHeaders({
      cookie: "nexus_session=tok_attacker",
      "x-nexus-actor-id": "usr_attacker",
      "content-type": "multipart/form-data; boundary=nexus-boundary",
      "content-length": String(65 * 1024 * 1024 + 1),
    }),
    body: "small test body",
  });
}

/** Chunked body that exceeds the byte ceiling without Content-Length. */
export function buildUploadPreflightHttpOversizedChunkedRequest() {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < 5; index += 1) {
        controller.enqueue(new Uint8Array(256 * 1024));
      }
      controller.close();
    },
  });

  return new NextRequest("http://nexus.test/api/products/prd_target/builds", {
    method: "POST",
    headers: browserMutationHeaders({
      cookie: "nexus_session=tok_attacker",
      "x-nexus-actor-id": "usr_attacker",
      "content-type": "multipart/form-data; boundary=nexus-boundary",
    }),
    body,
    duplex: "half",
  } as unknown as ConstructorParameters<typeof NextRequest>[1]);
}

/** Valid chunked multipart upload without Content-Length. */
export function buildUploadPreflightHttpValidChunkedRequest() {
  const body = Buffer.concat([
    Buffer.from(
      '--nexus-boundary\r\nContent-Disposition: form-data; name="version"\r\n\r\n1.2.3\r\n' +
        '--nexus-boundary\r\nContent-Disposition: form-data; name="file"; filename="resource.zip"\r\n' +
        "Content-Type: application/zip\r\n\r\n",
    ),
    Buffer.from(packageFixtures.stored, "base64"),
    Buffer.from("\r\n--nexus-boundary--\r\n"),
  ]);
  const chunks = [body.slice(0, 23), body.slice(23, 71), body.slice(71)];

  return new NextRequest("http://nexus.test/api/products/prd_target/builds", {
    method: "POST",
    headers: browserMutationHeaders({
      cookie: "nexus_session=tok_attacker",
      "x-nexus-actor-id": "usr_attacker",
      "content-type": "multipart/form-data; boundary=nexus-boundary",
    }),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    duplex: "half",
  } as unknown as ConstructorParameters<typeof NextRequest>[1]);
}

/** SHA-256 of the stored package fixture used by the happy-path upload. */
export function buildUploadPreflightHttpPackageSha256() {
  return createHash("sha256").update(Buffer.from(packageFixtures.stored, "base64")).digest("hex");
}

/** Byte length of the stored package fixture. */
export function buildUploadPreflightHttpPackageSizeBytes() {
  return Buffer.from(packageFixtures.stored, "base64").length;
}
