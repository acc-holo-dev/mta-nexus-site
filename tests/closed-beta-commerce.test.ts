import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("closed beta commerce guard", () => {
  it("keeps paid checkout explicitly disabled", () => {
    const route = readFileSync(
      path.resolve(process.cwd(), "apps/web/src/app/api/checkout/route.ts"),
      "utf8"
    );

    expect(route).toContain("CHECKOUT_DISABLED");
    expect(route).toContain("{ status: 503 }");
    expect(route).not.toContain("createOrderAndCheckout");
  });
});
