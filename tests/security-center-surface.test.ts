import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("security center surface", () => {
  it("is linked from account navigation and requires a real session", () => {
    const sidebar = read("apps/web/src/components/sidebar.tsx");
    const page = read("apps/web/src/app/security/page.tsx");
    expect(sidebar).toContain('href: "/security"');
    expect(page).toContain('get("nexus_session")');
    expect(page).toContain("authService.getSession(token)");
  });

  it("reads actor-scoped audit events and exposes no raw details", () => {
    const repository = read("packages/db/src/repositories/audit.ts");
    const service = read("apps/web/src/lib/services/security-center-service.ts");
    expect(repository).toContain("eq(auditEvents.actorId, actorId)");
    expect(repository).toContain("inArray(auditEvents.action, actions)");
    expect(service).toContain("toSecurityActivityItem(event)");
    expect(service).not.toContain("event.details");
  });
});
