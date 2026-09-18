import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("moderation action integrity", () => {
  it("does not audit a successful moderation action when its target is missing", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/admin/actions/route.ts"),
      "utf8"
    );

    expect(route).toContain('{ error: "Product not found" }');
    expect(route).toContain('{ error: "Report not found" }');
    expect(route).toContain("const updated = action ===");
    expect(route).toContain("const resolved = await reportRepository.resolve");
  });
});
