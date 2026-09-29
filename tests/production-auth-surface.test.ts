import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("production authentication surface", () => {
  it("does not publish seeded credentials or prefill a privileged account", () => {
    const loginPage = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/auth/login/page.tsx"),
      "utf8"
    );

    expect(loginPage).not.toContain("Quick Demo Logins");
    expect(loginPage).not.toContain("admin@mta-nexus.com");
    expect(loginPage).not.toContain('useState("password123")');
  });
});
