import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const OBS_001_ROUTES = [
  "apps/web/src/app/api/auth/login/route.ts",
  "apps/web/src/app/api/auth/password-reset/route.ts",
  "apps/web/src/app/api/products/[id]/builds/route.ts",
  "apps/web/src/app/api/reports/route.ts",
  "apps/web/src/app/api/servers/directory/route.ts",
  "apps/web/src/app/api/health/route.ts",
] as const;

describe("request correlation lint policy", () => {
  it("forbids direct console bypasses on the OBS-001 route slice", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "biome.json"), "utf8"),
    ) as {
      overrides?: Array<{
        name?: string;
        includes?: string[];
        linter?: {
          rules?: {
            suspicious?: {
              noConsole?: string;
            };
          };
        };
      }>;
    };

    const policy = config.overrides?.find(
      (override) =>
        override.name === "obs-001-structured-api-logging",
    );

    expect(policy).toBeTruthy();
    expect(policy?.includes?.slice().sort()).toEqual(
      [...OBS_001_ROUTES].sort(),
    );
    expect(
      policy?.linter?.rules?.suspicious?.noConsole,
    ).toBe("error");
  });
});
