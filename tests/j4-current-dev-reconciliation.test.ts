import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("current-dev build upload reconciliation", () => {
  it("keeps target authorization before request body work and infrastructure calls", () => {
    const route = read("apps/web/src/app/api/products/[id]/builds/route.ts");

    const preflight = route.indexOf("productService.assertCanReleaseBuild(productId, user)");
    const contentLength = route.indexOf('request.headers.get("content-length")');
    const contentType = route.indexOf('request.headers.get("content-type")');
    const formData = route.indexOf("parseMultipartFormDataWithLimit(");
    const arrayBuffer = route.indexOf("await file.arrayBuffer()");
    const scan = route.indexOf("buildScannerService.scan(");
    const storage = route.indexOf("storageService.uploadAsset(");

    expect(preflight).toBeGreaterThan(-1);
    expect(contentLength).toBeGreaterThan(preflight);
    expect(contentType).toBeGreaterThan(contentLength);
    expect(formData).toBeGreaterThan(contentType);
    expect(arrayBuffer).toBeGreaterThan(formData);
    expect(scan).toBeGreaterThan(arrayBuffer);
    expect(storage).toBeGreaterThan(scan);
  });

  it("uses correlated JSON for scanner outages instead of an undefined NextResponse symbol", () => {
    const route = read("apps/web/src/app/api/products/[id]/builds/route.ts");

    expect(route).toContain('event: "resource.build.scanner_unavailable"');
    expect(route).toContain(
      '"Malware scanning is temporarily unavailable. No build was stored; retry the upload later."',
    );
    expect(route).toContain('{ status: 503, headers: { "Retry-After": "30" } }');
    expect(route).not.toContain("NextResponse.json(");
    expect(route).toContain("jsonWithRequestId(");
  });

  it("keeps releaseBuild authoritative with the same preflight helper", () => {
    const service = read("apps/web/src/lib/services/product-service.ts");

    expect(service).toContain("async assertCanReleaseBuild(");
    expect(service).toContain('this.canManageProduct(product, actor, "build.release")');

    const release = service.slice(
      service.indexOf("async releaseBuild("),
      service.indexOf("async reviewBuild("),
    );
    expect(release).toContain("await this.assertCanReleaseBuild(");
  });
});
