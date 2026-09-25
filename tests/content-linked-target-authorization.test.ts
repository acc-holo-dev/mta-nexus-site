import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("content linked target authorization", () => {
  it("requires server management rights before accepting serverId", () => {
    const route = read("apps/web/src/app/api/content/route.ts");

    expect(route).toContain("serverRepository.findById(parsed.data.serverId)");
    expect(route).toContain('can(user, "server.manage", linkedServer');
    expect(route).toContain("You do not manage the linked server");
  });

  it("requires product management rights before accepting productId", () => {
    const route = read("apps/web/src/app/api/content/route.ts");

    expect(route).toContain("productRepository.findById(parsed.data.productId)");
    expect(route).toContain('can(user, "product.update", linkedProduct');
    expect(route).toContain("You do not manage the linked resource");
  });

  it("reuses one membership lookup for linked organization-backed targets", () => {
    const route = read("apps/web/src/app/api/content/route.ts");

    expect(route).toContain("const getMemberships = async () =>");
    expect(route).toContain(
      "memberships ??= await organizationRepository.listUserMemberships(user.id)",
    );
    expect(route.match(/await getMemberships\(\)/gu)?.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps missing targets distinct from unauthorized existing targets", () => {
    const route = read("apps/web/src/app/api/content/route.ts");

    expect(route).toContain('"Linked server was not found"');
    expect(route).toContain('"Linked resource was not found"');
    expect(route).toContain('{ status: 404 }');
    expect(route).toContain('{ status: 403 }');
  });
});
