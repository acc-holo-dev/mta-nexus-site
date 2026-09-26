import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("client mutation confirmation", () => {
  it("uses canonical server responses before showing server save success", () => {
    const form = read(
      "apps/web/src/components/server-details-form.tsx",
    );

    expect(form).toContain('typeof data?.server?.id !== "string"');
    expect(form).toContain("data.server.id !== server.id");
    expect(form.indexOf("data.server.id !== server.id")).toBeLessThan(
      form.indexOf("setNotice({ text: copy.saved"),
    );
  });

  it("requires explicit success for every admin moderation control", () => {
    for (const path of [
      "apps/web/src/components/build-moderation-controls.tsx",
      "apps/web/src/components/content-moderation-controls.tsx",
      "apps/web/src/components/verification-moderation-controls.tsx",
    ]) {
      const source = read(path);
      expect(source).toContain("data?.success !== true");
      expect(source.indexOf("data?.success !== true")).toBeLessThan(
        source.indexOf("router.refresh()"),
      );
    }
  });

  it("validates canonical notification preferences before changing local state", () => {
    const settings = read("apps/web/src/app/settings/page.tsx");

    expect(settings).toContain("function isPreferences");
    expect(settings).toContain("data.success !== true");
    expect(settings).toContain("!isPreferences(data.preferences)");
    expect(settings).toContain("setPreferences(data.preferences)");
    expect(settings).not.toContain(
      "previous ? { ...previous, [key]: value } : previous",
    );
  });

  it("keeps notification preference responses private and uncached", () => {
    const route = read(
      "apps/web/src/app/api/notifications/preferences/route.ts",
    );

    expect(route).toContain(
      'const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" }',
    );
    expect(route).toContain(
      "{ status: 401, headers: privateHeaders }",
    );
    expect(route).toContain(
      "{ status: 429, headers: privateHeaders }",
    );
    expect(route).toContain(
      "{ status: 400, headers: privateHeaders }",
    );
    expect(route).toContain("{ headers: privateHeaders }");
    expect(route).toContain(
      "{ status: 500, headers: privateHeaders }",
    );
  });
});
