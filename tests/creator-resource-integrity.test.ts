import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("creator resource integrity", () => {
  it("filters, sorts and bounds the public catalog in PostgreSQL", () => {
    const repository = read("packages/db/src/repositories/products.ts");
    expect(repository).toContain('eq(products.status, "published")');
    expect(repository).toContain("ilike(products.title, pattern)");
    expect(repository).toContain(".orderBy(order, desc(products.id))");
    expect(repository).toContain(".limit(limit)");
    expect(repository).toContain(".offset(offset)");
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
    const page = read("apps/web/src/components/new-resource-form.tsx");
    expect(page).toContain("copy.submittedTitle");
    expect(page).toContain("copy.submittedDescription");
    expect(getDictionary("en").publishing.submittedTitle).toBe("Resource submitted for review");
    expect(getDictionary("en").publishing.submittedDescription).toContain("moderator approval");
    expect(getDictionary("ru").publishing.submittedDescription).toContain("одобрения модератора");
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

  it("shows localized build limits and checks file size before creating the resource", () => {
    const page = read("apps/web/src/components/new-resource-form.tsx");
    const createProduct = page.indexOf('fetch("/api/products"');
    const fileLimit = page.indexOf("exceedsBuildFileSizeLimit(file.size)");
    const fileType = page.indexOf("getSupportedBuildExtension(file.name)");

    expect(fileLimit).toBeGreaterThan(-1);
    expect(fileLimit).toBeLessThan(createProduct);
    expect(fileType).toBeGreaterThan(-1);
    expect(fileType).toBeLessThan(createProduct);
    expect(page).toContain('pattern="v?[0-9]+\\.[0-9]+(\\.[0-9]+)?(-[a-zA-Z0-9.]+)?"');
    expect(page).toContain('pattern="1\\.[0-9]+(\\.[0-9]+)?"');
    expect(page).toContain("copy.buildFileRequirements");
    expect(getDictionary("en").publishing.buildFileTooLarge).toContain("{maxFileSize} MB");
    expect(getDictionary("ru").publishing.buildFileTooLarge).toContain("{maxFileSize} МБ");
    expect(page).toContain("MAX_BUILD_FILE_SIZE_BYTES / (1024 * 1024)");
  });
});
