import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("account security API", () => {
  it("lists metadata only and supports owned session revocation", () => {
    const route = readFileSync(resolve(process.cwd(), "apps/web/src/app/api/auth/sessions/route.ts"), "utf8");
    expect(route).toContain("authService.listSessions");
    expect(route).toContain("getCurrentSessionId");
    expect(route).toContain("body.allOther === true");
    expect(route).toContain("The current session cannot be revoked");
    expect(route).not.toContain("session.token");
  });
  it("excludes expired sessions from the active-session list", () => {
    const sessions = readFileSync(resolve(process.cwd(), "packages/db/src/repositories/sessions.ts"), "utf8");
    expect(sessions).toContain("gt(sessions.expiresAt, new Date())");
  });
  it("requires the current password and delegates the atomic credential change", () => {
    const route = readFileSync(resolve(process.cwd(), "apps/web/src/app/api/auth/password/route.ts"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "apps/web/src/lib/services/auth-service.ts"), "utf8");
    expect(route).toContain('consumeRateLimit("passwordChange", user.id)');
    expect(route).toContain("changePasswordSchema");
    expect(service).toContain("verifyPassword(input.currentPassword");
    // Runtime transaction rollback/concurrency is covered in password-change-transaction.test.ts.
    expect(service).toContain("authRepository.changePassword");
    expect(route).toContain('response.cookies.set("nexus_session", changed.token');
    expect(route).not.toContain("json(changed)");
  });
});
