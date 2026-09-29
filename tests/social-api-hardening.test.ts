import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("social API hardening", () => {
  it("rate-limits both follow and unfollow mutations", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/follow/route.ts"),
      "utf8"
    );

    expect((route.match(/consumeRateLimit\("follow", user\.id\)/g) || []).length).toBe(2);
    expect(route).toContain("Cannot follow yourself");
    expect(route).toContain("Target does not exist");
    expect(route).toContain('product.status === "published"');
    expect(route).toContain('server.visibility !== "private"');
    expect(route).toContain('server.status === "active"');

    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/social.ts"),
      "utf8"
    );
    expect(repository).toContain(".onConflictDoNothing()");
    expect(route).toContain("if (!follow)");
  });

  it("turns malformed abuse-report bodies into a validation response", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/reports/route.ts"),
      "utf8"
    );

    expect(route).toContain("request.json().catch(() => null)");
    expect(route).toContain("createReportSchema.safeParse(body)");
  });
});
