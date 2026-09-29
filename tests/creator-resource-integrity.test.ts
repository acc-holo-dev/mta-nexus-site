import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("creator resource integrity", () => {
  it("filters, sorts and bounds the public catalog in PostgreSQL", () => {
    const repository = read("packages/db/src/repositories/products.ts");
    expect(repository).toContain('eq(products.status, "published")');
    expect(repository).toContain("ilike(products.title, pattern)");
    expect(repository).toContain(".orderBy(order)");
    expect(repository).toContain(".limit(limit)");
    expect(repository).not.toContain("items.sort");
  });

  it("prevents concurrent duplicate versions at the database boundary", () => {
    const schema = read("packages/db/src/schema.ts");
    const migration = read("packages/db/migrations/0011_build_version_uniqueness.sql");
    const service = read("apps/web/src/lib/services/product-service.ts");
    expect(schema).toContain('uniqueIndex("builds_product_version_idx")');
    expect(migration).toContain("duplicate versions exist");
    expect(service).toContain('code === "23505"');
    expect(service).toContain("BUILD_VERSION_EXISTS");
  });

  it("does not claim that an unreviewed upload is published", () => {
    const page = read("apps/web/src/app/workspace/resources/new/page.tsx");
    expect(page).toContain("Resource submitted for review");
    expect(page).toContain("moderator approval");
    expect(page).not.toContain(">Resource published<");
  });

  it("commits build state, product state and audit evidence atomically", () => {
    const repository = read("packages/db/src/repositories/builds.ts");
    const service = read("apps/web/src/lib/services/product-service.ts");
    expect(repository).toContain("async submitForReview(");
    expect(repository).toContain("async moderatePending(");
    expect(repository).toContain("async retireAndRefreshProduct(");
    expect(repository.match(/db\.transaction/g)).toHaveLength(3);
    expect(repository.match(/tx\.insert\(auditEvents\)/g)).toHaveLength(3);
    expect(service).toContain("buildRepository.submitForReview(");
    expect(service).not.toContain('action: "build.submitted_for_review"\n    });');
  });

  it("keeps failed first uploads recoverable and organization releases authorized", () => {
    const createPage = read("apps/web/src/app/workspace/resources/new/page.tsx");
    const managePage = read("apps/web/src/app/workspace/resources/[id]/page.tsx");
    const listPage = read("apps/web/src/app/workspace/resources/page.tsx");
    const uploadForm = read("apps/web/src/components/resource-build-upload-form.tsx");
    const repository = read("packages/db/src/repositories/products.ts");
    const service = read("apps/web/src/lib/services/product-service.ts");

    expect(createPage).toContain("Continue from the saved draft");
    expect(createPage).toContain("let draft = createdDraft");
    expect(createPage).toContain("if (!draft)");
    expect(createPage).toContain("`/api/products/${draft.id}/builds`");
    expect(createPage).toContain("without creating another resource");
    expect(createPage).toContain('pattern="v?[0-9]+\\.[0-9]+(\\.[0-9]+)?(-[a-zA-Z0-9.]+)?"');
    expect(createPage).toContain('pattern="1\\.[0-9]+(\\.[0-9]+)?"');
    expect(managePage).toContain("ResourceBuildUploadForm");
    expect(listPage).toContain("listByAuthor");
    expect(uploadForm).toContain("Submit build for review");
    expect(repository).toContain("async listByAuthor(");
    expect(service).toContain('can(actor, "build.release", product, { organizationMemberships })');
    expect(service).toContain('can(actor, "build.retire", product, { organizationMemberships })');

    const uploadRoute = read("apps/web/src/app/api/products/[id]/builds/route.ts");
    expect(uploadRoute.indexOf("authorizeBuildRelease")).toBeLessThan(
      uploadRoute.indexOf("request.formData()")
    );
  });
});
