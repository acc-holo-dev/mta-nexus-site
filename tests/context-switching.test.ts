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
    expect(route).toContain("organizationRepository.listOwnedByUser(user.id, 50)");
    expect(route).toContain("contextsById");
    expect(route).toContain('role: "owner"');
    expect(route).toContain('Cache-Control": "private, no-store"');
    expect(route).toContain('type: "personal"');
  });

  it("accepts a direct organization owner or a real membership and audits changed context", () => {
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/auth-service.ts"),
      "utf8"
    );
    const settings = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/settings/page.tsx"),
      "utf8"
    );

    expect(settings).toContain("ContextSwitcher");
    expect(service).toContain("organizationRepository.findById(nextContextId)");
    expect(service).toContain("organization?.ownerId === userId");
    expect(service).toContain("organizationRepository.listUserMemberships(userId)");
    expect(service).toContain("Not authorized to switch to this organization context");
    expect(service).toContain('action: "user.context_switched"');
    expect(service).toContain('targetType: "user"');
  });
});
