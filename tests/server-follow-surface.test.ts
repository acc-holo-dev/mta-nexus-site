import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("saved target surfaces", () => {
  it("uses the shared follow API for signed-in users and links guests to login", () => {
    const button = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/saved-target-button.tsx"),
      "utf8"
    );
    const serverPage = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/servers/[slug]/page.tsx"),
      "utf8"
    );
    const resourcePage = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/market/[slug]/page.tsx"),
      "utf8"
    );

    expect(button).toContain('fetch("/api/follow"');
    expect(button).toContain("targetType, targetId");
    expect(button).toContain('aria-pressed={saved}');
    expect(button).toContain('href="/auth/login"');
    expect(serverPage).toContain('socialRepository.isFollowing(currentUser.id, "server", server.id)');
    expect(serverPage).toContain('<SavedTargetButton');
    expect(serverPage).toContain('targetType="server"');
    expect(resourcePage).toContain('socialRepository.isFollowing(user.id, "product", product.id)');
    expect(resourcePage).toContain("canSaveResource = isPublished && product.price === 0");
    expect(resourcePage).toContain('targetType="product"');
    expect(resourcePage).toContain("initialSaved={isSaved}");
  });

  it("loads only followed public targets through bounded repository queries", () => {
    const savedPage = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/workspace/saved/page.tsx"),
      "utf8"
    );
    const products = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/products.ts"),
      "utf8"
    );
    const servers = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/servers.ts"),
      "utf8"
    );

    expect(savedPage).toContain("productRepository.listPublishedFreeByIds");
    expect(savedPage).toContain("serverRepository.listActiveVisibleByIds");
    expect(products).toContain("async listPublishedFreeByIds");
    expect(servers).toContain("async listActiveVisibleByIds");
    expect(savedPage).not.toContain("productRepository.list()");
    expect(savedPage).not.toContain("serverRepository.listActivePublic()");
  });
});
