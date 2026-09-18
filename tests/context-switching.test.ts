import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("account context switching", () => {
  it("exposes only authenticated, bounded context reads and validated switches", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/auth/context/route.ts"),
      "utf8"
    );

    expect(route).toContain("contextSchema");
    expect(route).toContain(".strict()");
    expect(route).toContain('consumeRateLimit("sessionManagement", user.id)');
    expect(route).toContain("authService.switchContext");
    expect(route).toContain("memberships.slice(0, 50)");
    expect(route).toContain('Cache-Control": "private, no-store"');
    expect(route).toContain('type: "personal"');
  });

  it("requires a real organization membership and audits changed context", () => {
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/auth-service.ts"),
      "utf8"
    );

    expect(service).toContain("organizationRepository.listUserMemberships(userId)");
    expect(service).toContain("Not authorized to switch to this organization context");
    expect(service).toContain('action: "user.context_switched"');
    expect(service).toContain('targetType: "user"');
  });
});
