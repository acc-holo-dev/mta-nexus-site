import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routes = [
  "apps/web/src/app/api/auth/login/route.ts",
  "apps/web/src/app/api/auth/password-reset/route.ts",
  "apps/web/src/app/api/products/[id]/builds/route.ts",
  "apps/web/src/app/api/reports/route.ts",
  "apps/web/src/app/api/servers/directory/route.ts",
  "apps/web/src/app/api/health/route.ts",
];

describe("request correlation surface", () => {
  it("keeps the OBS-001 route slice on structured request logging", () => {
    for (const routePath of routes) {
      const source = readFileSync(resolve(process.cwd(), routePath), "utf8");
      expect(source, routePath).toContain("createRequestLogContext");
      expect(source, routePath).toContain("jsonWithRequestId");
      expect(source, routePath).not.toMatch(/console\.(?:error|warn|log|info)\s*\(/u);
    }
  });

  it("does not pass request bodies, cookies or authorization headers into logger calls", () => {
    for (const routePath of routes) {
      const source = readFileSync(resolve(process.cwd(), routePath), "utf8");
      const loggerCalls = source.match(/logRequestEvent\(\{[\s\S]*?\}\);/gu) ?? [];
      for (const call of loggerCalls) {
        expect(call, routePath).not.toMatch(
          /(?:authorization|cookie|token|secret|password|email|clientIp|headers|body|query|url)\s*:/iu,
        );
      }
    }
  });
});
