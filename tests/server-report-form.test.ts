import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("server report form", () => {
  it("uses the authenticated report API contract and offers sign-in to guests", () => {
    const form = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/server-report-form.tsx"),
      "utf8"
    );
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/servers/[slug]/page.tsx"),
      "utf8"
    );

    expect(form).toContain('fetch("/api/reports"');
    expect(form).toContain('targetType: "server"');
    expect(form).toContain('href="/auth/login"');
    expect(form).toContain('role="alert"');
    expect(page).toContain("<ServerReportForm");
  });
});
