import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("canonical organization resource authorization surface", () => {
  it("uses one product management helper for preview, build release and retirement", () => {
    const service = read(
      "apps/web/src/lib/services/product-service.ts",
    );

    expect(service).toContain("async canManageProduct(");
    expect(service).toContain("organization?.ownerId === actor.id");
    expect(service).toContain(
      "organizationRepository.listUserMemberships(actor.id)",
    );
    expect(service).toContain(
      "await this.canManageProduct(product, actor)",
    );
    expect(service).toContain(
      'await this.canManageProduct(product, actor, "build.release")',
    );
    expect(service).toContain(
      'await this.canManageProduct(product, actor, "build.retire")',
    );
  });

  it("authorizes linked content through the canonical server and product service contracts", () => {
    const route = read("apps/web/src/app/api/content/route.ts");

    expect(route).toContain(
      "serverService.canManageServer(linkedServer, user)",
    );
    expect(route).toContain(
      "productService.canManageProduct(linkedProduct, user)",
    );
    expect(route).toContain("You do not manage the linked server");
    expect(route).toContain("You do not manage the linked resource");
    expect(route).not.toContain(
      'can(user, "server.manage", linkedServer',
    );
    expect(route).not.toContain(
      'can(user, "product.update", linkedProduct',
    );
  });

  it("keeps organization owner support explicit rather than assuming an owner membership row exists", () => {
    const organizations = read(
      "packages/db/src/repositories/organizations.ts",
    );
    const productService = read(
      "apps/web/src/lib/services/product-service.ts",
    );
    const serverService = read(
      "apps/web/src/lib/services/server-service.ts",
    );

    expect(organizations).not.toContain(
      "insert(organizationMembers).values",
    );
    expect(productService).toContain("organization?.ownerId === actor.id");
    expect(serverService).toContain("organization?.ownerId === actor.id");
  });

  it("does not convert organization server creation into personal ownership", () => {
    const route = read("apps/web/src/app/api/servers/route.ts");
    const service = read(
      "apps/web/src/lib/services/server-service.ts",
    );

    expect(route).toContain(
      "ownerId: parsed.data.organizationId ? undefined : user.id",
    );
    expect(service).toContain(
      'membership?.permissions.includes("manage_servers")',
    );

    const createSection = service.slice(
      service.indexOf("async createServer("),
      service.indexOf("async canManageServer("),
    );
    expect(createSection).not.toContain(
      'membership?.role === "developer"',
    );
  });
});
