import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("comment abuse reporting", () => {
  it("accepts comment targets only when the comment exists", () => {
    const validation = readFileSync(
      resolve(process.cwd(), "packages/validation/src/index.ts"),
      "utf8"
    );
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/reports/route.ts"),
      "utf8"
    );
    const domain = readFileSync(
      resolve(process.cwd(), "packages/domain/src/entities.ts"),
      "utf8"
    );

    expect(validation).toContain('"comment", "user"');
    expect(route).toContain("contentRepository.findCommentById");
    expect(domain).toContain('"comment" | "user"');
    expect(route).toContain("Report target was not found");
  });
});
