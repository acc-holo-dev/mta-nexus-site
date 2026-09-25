import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("moderation atomicity surface", () => {
  it("keeps content state and audit in one repository transaction", () => {
    const repository = read("packages/db/src/repositories/content.ts");
    const service = read("apps/web/src/lib/services/content-service.ts");

    expect(repository).toContain("async moderateStatusWithAudit(");
    expect(repository).toContain("return db.transaction(async (tx) =>");
    expect(repository).toContain("tx.insert(auditEvents)");
    expect(service).toContain("contentRepository.moderateStatusWithAudit(");
  });

  it("routes product/report/verification moderation through atomic audit methods", () => {
    const route = read("apps/web/src/app/api/admin/actions/route.ts");

    expect(route).toContain("productRepository.updateWithAudit(");
    expect(route).toContain("productRepository.suspendPublished(");
    expect(route).toContain(
      "productRepository.restoreSuspendedWithPublishedBuild(",
    );
    expect(route).toContain("reportRepository.resolve(");
    expect(route).toContain("verificationRepository.resolveRequest(");
    expect(route).not.toContain("auditRepository.record(");
  });

  it("prevents restore from becoming a generic publication shortcut", () => {
    const repository = read("packages/db/src/repositories/products.ts");

    expect(repository).toContain("restoreSuspendedWithPublishedBuild");
    expect(repository).toContain('eq(products.status, "suspended")');
    expect(repository).toContain('eq(builds.status, "published")');
    expect(repository).toContain('"no_published_build"');
    expect(repository).toContain("suspendPublished");
    expect(repository).toContain('eq(products.status, "published")');
  });
});
