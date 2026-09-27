import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const privateGetRoutes = [
  "apps/web/src/app/api/auth/context/route.ts",
  "apps/web/src/app/api/notifications/preferences/route.ts",
  "apps/web/src/app/api/notifications/route.ts",
  "apps/web/src/app/api/reports/route.ts",
  "apps/web/src/app/api/verification/route.ts",
  "apps/web/src/app/api/products/[id]/download/route.ts",
];

describe("private GET cache policy", () => {
  it.each(privateGetRoutes)(
    "%s declares private no-store responses that vary by cookie",
    (path) => {
      const source = read(path);
      expect(source).toContain('"Cache-Control": "private, no-store"');
      expect(source).toContain('Vary: "Cookie"');
    },
  );

  it("keeps guest notification reads private instead of cacheable anonymous state", () => {
    const notifications = read(
      "apps/web/src/app/api/notifications/route.ts",
    );
    const preferences = read(
      "apps/web/src/app/api/notifications/preferences/route.ts",
    );

    expect(notifications).toContain(
      'NextResponse.json({ notifications: [], unreadCount: 0 }, { headers: privateHeaders })',
    );
    expect(preferences).toContain(
      '{ status: 401, headers: privateHeaders }',
    );
  });

  it("keeps moderator and verification reads private on both allow and deny branches", () => {
    const reports = read("apps/web/src/app/api/reports/route.ts");
    const verification = read(
      "apps/web/src/app/api/verification/route.ts",
    );

    expect(reports).toContain(
      'privateJson(context, { error: "Unauthorized" }, { status: 403 })',
    );
    expect(reports).toContain(
      'return privateJson(context, { reports });',
    );
    expect(reports).toContain('headers.set("Cache-Control", privateHeaders["Cache-Control"]);');
    expect(verification).toContain(
      'return json({ error: "Unauthorized" }, 401);',
    );
    expect(verification).toContain(
      "return json({ requests });",
    );
    expect(verification).toContain("headers: privateHeaders");
  });

  it("keeps every explicit download outcome private", () => {
    const download = read(
      "apps/web/src/app/api/products/[id]/download/route.ts",
    );

    for (const status of [401, 403, 404, 429, 500]) {
      expect(download).toContain(
        'status: ' + status + ', headers: privateHeaders',
      );
    }
    expect(download).toContain("...privateHeaders");
    expect(download).toContain('"X-Content-SHA256"');
  });

  it("does not convert public discovery reads to private caching", () => {
    for (const path of [
      "apps/web/src/app/api/products/route.ts",
      "apps/web/src/app/api/servers/route.ts",
      "apps/web/src/app/api/content/route.ts",
      "apps/web/src/app/api/search/route.ts",
      "apps/web/src/app/api/servers/directory/route.ts",
    ]) {
      const source = read(path);
      expect(source).toMatch(/"Cache-Control"\s*:\s*"public/u);
    }
  });

  it("marks follow-state GET responses private because following is session-specific", () => {
    const route = read("apps/web/src/app/api/follow/route.ts");

    expect(route).toContain(
      'const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" }',
    );
    expect(route).toContain(
      '{ authenticated: false, following: false }',
    );
    expect(route).toContain(
      '{ authenticated: true, following }',
    );
  });
});
