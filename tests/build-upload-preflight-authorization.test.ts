import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("build upload preflight authorization", () => {
  it("authorizes the product target before parsing, reading, scanning or storing the upload", () => {
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
    expect(contentType).toBeGreaterThan(preflight);
    expect(formData).toBeGreaterThan(contentType);
    expect(arrayBuffer).toBeGreaterThan(formData);
    expect(scan).toBeGreaterThan(arrayBuffer);
    expect(storage).toBeGreaterThan(scan);
  });

  it("keeps a second authorization check inside releaseBuild", () => {
    const service = read("apps/web/src/lib/services/product-service.ts");

    expect(service).toContain("async assertCanReleaseBuild(");
    expect(service).toContain('this.canManageProduct(product, actor, "build.release")');

    const releaseBuild = service.slice(
      service.indexOf("async releaseBuild("),
      service.indexOf("async reviewBuild("),
    );
    expect(releaseBuild).toContain("await this.assertCanReleaseBuild(");
  });
});
