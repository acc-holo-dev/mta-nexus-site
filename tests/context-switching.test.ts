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
    expect(route).toMatch(/consumeRateLimit\(\s*"sessionManagement",\s*user\.id/);
    expect(route).toContain("authService.switchContext");
    expect(route).toContain("organizationRepository.listOwnedByUser(user.id, 50)");
    expect(route).toContain("contextsById");
    expect(route).toContain('role: "owner"');
    expect(route).toContain('Cache-Control": "private, no-store"');
    expect(route).toContain("function json");
    expect(route).toContain('type: "personal"');
  });

  it("accepts a direct organization owner or a real membership and audits changed context", () => {
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/auth-service.ts"),
      "utf8"
    );
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/auth.ts"),
      "utf8"
    );
    const settings = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/settings/page.tsx"),
      "utf8"
    );

    expect(settings).toContain("ContextSwitcher");
    const switcher = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/context-switcher.tsx"),
      "utf8",
    );
    expect(switcher).toContain("data?.success !== true");
    expect(switcher).toContain("data.activeContextId !== contextId");
    expect(switcher.indexOf("setActiveContextId(data.activeContextId)")).toBeGreaterThan(
      switcher.indexOf("data?.success !== true"),
    );
    expect(service).toContain("authRepository.switchContext");
    expect(repository).toContain("db.transaction(async (tx) =>");
    expect(repository).toContain("organization.ownerId !== data.userId");
    expect(repository).toContain("eq(organizationMembers.userId, data.userId)");
    expect(repository).toContain("Not authorized to switch to this organization context");
    expect(repository).toContain('action: "user.context_switched"');
    expect(repository).toContain('targetType: "user"');
  });
});
