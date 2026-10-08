import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("request correlation lint policy", () => {
  it("forbids direct console bypasses across every API route", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "biome.json"), "utf8"),
    ) as {
      overrides?: Array<{
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
      (override) => override.includes?.includes("apps/web/src/app/api/**"),
    );

    expect(policy).toBeTruthy();
    expect(policy?.includes).toEqual([
      "apps/web/src/app/api/**",
    ]);
    expect(
      policy?.linter?.rules?.suspicious?.noConsole,
    ).toBe("error");
  });
});
