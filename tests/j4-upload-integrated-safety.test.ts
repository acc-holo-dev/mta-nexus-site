import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("integrated J4 build upload safety contract", () => {
  it("orders cheap authorization and input guards before body parsing and scanner/storage work", () => {
    const route = read(
      "apps/web/src/app/api/products/[id]/builds/route.ts",
    );

    const auth = route.indexOf("authService.getSession(token)");
    const rate = route.indexOf(
      'consumeRateLimit("buildUpload", user.id)',
    );
    const preflight = route.indexOf(
      "productService.assertCanReleaseBuild(productId, user)",
    );
    const contentLength = route.indexOf(
      'request.headers.get("content-length")',
    );
    const contentType = route.indexOf(
      'request.headers.get("content-type")',
    );
    const formData = route.indexOf("parseMultipartFormDataWithLimit(");
    const arrayBuffer = route.indexOf("await file.arrayBuffer()");
    const scan = route.indexOf("buildScannerService.scan(");
    const storage = route.indexOf("storageService.uploadAsset(");

    for (const position of [
      auth,
      rate,
      preflight,
      contentLength,
      contentType,
      formData,
      arrayBuffer,
      scan,
      storage,
    ]) {
      expect(position).toBeGreaterThan(-1);
    }

    expect(rate).toBeGreaterThan(auth);
    expect(preflight).toBeGreaterThan(rate);
    expect(contentLength).toBeGreaterThan(preflight);
    expect(contentType).toBeGreaterThan(contentLength);
    expect(formData).toBeGreaterThan(contentType);
    expect(arrayBuffer).toBeGreaterThan(formData);
    expect(scan).toBeGreaterThan(arrayBuffer);
    expect(storage).toBeGreaterThan(scan);
  });

  it("keeps malicious and scanner-error verdicts fail-closed before storage", () => {
    const route = read(
      "apps/web/src/app/api/products/[id]/builds/route.ts",
    );

    const malicious = route.indexOf('scan.status === "malicious"');
    const unavailable = route.indexOf('scan.status === "error"');
    const storage = route.indexOf("storageService.uploadAsset(");

    expect(malicious).toBeGreaterThan(-1);
    expect(unavailable).toBeGreaterThan(malicious);
    expect(storage).toBeGreaterThan(unavailable);
    expect(route).toContain(
      "Malware scanning is temporarily unavailable. No build was stored; retry the upload later.",
    );
    expect(route).toContain(
      'status: 503, headers: { "Retry-After": "30" }',
    );
  });

  it("retains a second organization-aware authorization check at the mutation boundary", () => {
    const service = read(
      "apps/web/src/lib/services/product-service.ts",
    );

    expect(service).toContain("async assertCanReleaseBuild(");
    expect(service).toContain(
      'this.canManageProduct(product, actor, "build.release")',
    );

    const releaseBuild = service.slice(
      service.indexOf("async releaseBuild("),
      service.indexOf("async reviewBuild("),
    );
    expect(releaseBuild).toContain(
      "await this.assertCanReleaseBuild(",
    );
  });

  it("uses a backpressure-aware bounded ClamAV INSTREAM transport", () => {
    const scanner = read(
      "apps/web/src/lib/services/build-scanner-service.ts",
    );
    const transport = read(
      "apps/web/src/lib/services/clamav-instream.ts",
    );

    expect(scanner).toContain(
      "writeClamAvInstream(socket, bytes)",
    );
    expect(scanner).toContain(
      "const CLAMAV_MAX_RESPONSE_BYTES = 8 * 1024",
    );
    expect(transport).toContain('socket.once("drain"');
    expect(transport).toContain(
      "const CLAMAV_CHUNK_BYTES = 64 * 1024",
    );
  });

  it("keeps moderation on the deterministic serialized publication path", () => {
    const repository = read(
      "packages/db/src/repositories/builds.ts",
    );
    const service = read(
      "apps/web/src/lib/services/product-service.ts",
    );

    const dollar = "$";
    expect(repository).toContain(
      `.set({ updatedAt: sql\`${dollar}{products.updatedAt}\` })`,
    );
    expect(repository).toContain(
      ".orderBy(desc(builds.createdAt), desc(builds.id))",
    );
    expect(repository).toContain(
      "currentVersion: latestPublished[0].version",
    );
    expect(service).toMatch(/input\.decision === "approve" &&\s*\([\s\S]*?build\.scanStatus !== "clean"/);
    expect(service).toContain("!build.scanner?.trim()");
    expect(service).toContain("!build.scannedAt");
    expect(service).toContain('"BUILD_SCAN_NOT_CLEAN"');
    expect(service).toContain('"BUILD_STATE_CHANGED"');
  });

  it("keeps reviewer artifact access private and limited to pending clean builds", () => {
    const route = read(
      "apps/web/src/app/api/admin/builds/[buildId]/download/route.ts",
    );

    expect(route).toContain('can(actor, "admin.moderation")');
    expect(route).toContain('build.status !== "pending_review"');
    expect(route).toContain('build.scanStatus !== "clean"');
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain('Vary: "Cookie"');
    expect(route).toContain('"X-Content-SHA256": build.sha256Hash');
    expect(route).toContain("destroyOpenedStream(stored.stream)");
  });

  it("requires build review context and writes the decision audit only in the transactional moderation path", () => {
    const route = read(
      "apps/web/src/app/api/admin/actions/route.ts",
    );
    const repository = read(
      "packages/db/src/repositories/builds.ts",
    );

    expect(route).toContain(
      'targetType: z.literal("build")',
    );
    expect(route).toContain(
      "notes: z.string().trim().min(3).max(2000)",
    );
    expect(route).toContain('targetType === "build"');
    expect(route).toContain("await productService.reviewBuild({");
    expect(repository).toContain(
      "await tx.insert(auditEvents).values",
    );
  });
});
