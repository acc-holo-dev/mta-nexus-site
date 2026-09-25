import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("resource meta inspector API", () => {
  it("requires an authenticated developer capability and a dedicated rate limit", () => {
    const route = read(
      "apps/web/src/app/api/resources/inspect-meta/route.ts",
    );
    const policy = read(
      "packages/security/src/rate-limit-policy.ts",
    );

    expect(route).toContain("authService.getSession(token)");
    expect(route).toContain('can(user, "product.create")');
    expect(route).toContain(
      'consumeRateLimit("resourceInspection", user.id)',
    );
    expect(policy).toContain(
      "resourceInspection: { limit: 30, windowSeconds: 60 }",
    );
  });

  it("checks content length before reading the request body and accepts text only", () => {
    const route = read(
      "apps/web/src/app/api/resources/inspect-meta/route.ts",
    );

    expect(route.indexOf("contentLengthTooLarge(request)")).toBeLessThan(
      route.indexOf("await request.text()"),
    );
    expect(route).toContain('contentType.startsWith("text/plain")');
    expect(route).toContain("status: 415");
    expect(route).toContain("status: 413");
  });

  it("never returns a static inspection as a security verdict", () => {
    const route = read(
      "apps/web/src/app/api/resources/inspect-meta/route.ts",
    );

    expect(route).toContain("securityVerdict: null");
    expect(route).toContain(
      "not a malware, trust, or archive-integrity verdict",
    );
    expect(route).toContain('"Cache-Control": "private, no-store"');
  });
});
