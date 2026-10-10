import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("social API hardening", () => {
  it("turns malformed abuse-report bodies into a validation response", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/reports/route.ts"),
      "utf8"
    );

    expect(route).toContain("request.json().catch(() => null)");
    expect(route).toContain("createReportSchema.safeParse(body)");
  });
});
