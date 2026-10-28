import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("development diagnostics", () => {
  it("is unavailable in production and reports only sanitized runtime state", () => {
    const page = read("apps/web/src/app/dev/page.tsx");

    expect(page).toContain('process.env.NODE_ENV === "production"');
    expect(page).toContain("notFound()");
    expect(page).toContain("checkDatabaseConnection");
    expect(page).toContain("config.STORAGE_PROVIDER");
    expect(page).toContain("config.BUILD_SCANNER");
    expect(page).toContain("config.EMAIL_PROVIDER");
    expect(page).toContain("config.NEXT_PUBLIC_APP_URL");

    for (const secret of [
      "AUTH_SECRET",
      "DATABASE_URL",
      "SMTP_PASS",
      "STORAGE_S3_SECRET_KEY",
      "DISCORD_CLIENT_SECRET",
    ]) {
      expect(page).not.toContain(secret);
    }
  });

  it("only exposes the navigation entry outside production", () => {
    const sidebar = read("apps/web/src/components/sidebar.tsx");
    expect(sidebar).toContain('process.env.NODE_ENV !== "production"');
    expect(sidebar).toContain('href: "/dev"');
    expect(sidebar).toContain("dictionary.nav.devTools");
  });
});
