import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("account security API", () => {
  it("lists metadata only and supports owned session revocation", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/auth/sessions/route.ts"),
      "utf8"
    );

    expect(route).toContain("authService.listSessions");
    expect(route).toContain("getCurrentSessionId");
    expect(route).toContain("body.allOther === true");
    expect(route).toContain("The current session cannot be revoked");
    expect(route).not.toContain("session.token");
  });

  it("excludes expired sessions from the active-session list", () => {\n    const sessions = readFileSync(\n      resolve(process.cwd(), "packages/db/src/repositories/sessions.ts"),\n      "utf8"\n    );\n\n    expect(sessions).toContain("gt(sessions.expiresAt, new Date())");\n  });\n\n  it("requires the current password before rotating credentials", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/auth/password/route.ts"),
      "utf8"
    );
    const service = readFileSync(
      resolve(process.cwd(), "apps/web/src/lib/services/auth-service.ts"),
      "utf8"
    );

    expect(route).toContain('consumeRateLimit("passwordChange", user.id)');
    expect(route).toContain("changePasswordSchema");
    expect(service).toContain("verifyPassword(input.currentPassword");
    expect(service).toContain("deleteOtherSessions(input.userId, input.currentToken)");
  });
});
