import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("authenticated mutation response privacy", () => {
  it.each([
    "apps/web/src/app/api/admin/actions/route.ts",
    "apps/web/src/app/api/content/[slug]/comments/route.ts",
    "apps/web/src/app/api/notifications/mark-read/route.ts",
    "apps/web/src/app/api/products/[id]/builds/[buildId]/route.ts",
    "apps/web/src/app/api/products/[id]/builds/route.ts",
    "apps/web/src/app/api/products/[id]/reviews/route.ts",
    "apps/web/src/app/api/products/route.ts",
    "apps/web/src/app/api/servers/[id]/route.ts",
    "apps/web/src/app/api/servers/route.ts",
    "apps/web/src/app/api/resources/inspect-meta/route.ts",
  ])("%s declares private no-store cookie-varying responses", (path) => {
    const source = read(path);

    expect(source).toContain('"Cache-Control": "private, no-store"');
    expect(source).toContain('Vary: "Cookie"');
  });

  it("keeps public resource and server GET responses publicly cacheable", () => {
    for (const path of [
      "apps/web/src/app/api/products/route.ts",
      "apps/web/src/app/api/servers/route.ts",
    ]) {
      const source = read(path);
      expect(source).toContain(
        '"Cache-Control": "public, max-age=30, stale-while-revalidate=120"',
      );
      expect(source).toContain("function privateJson");
      expect(source).toContain("export async function POST");
    }
  });

  it("keeps the public review GET separate from private review submission", () => {
    const source = read(
      "apps/web/src/app/api/products/[id]/reviews/route.ts",
    );

    const getStart = source.indexOf("export async function GET");
    const postStart = source.indexOf("export async function POST");
    expect(getStart).toBeGreaterThan(-1);
    expect(postStart).toBeGreaterThan(getStart);
    expect(
      source.slice(getStart, postStart),
    ).toContain("NextResponse.json");
    expect(source.slice(postStart)).toContain("privateJson");
  });

  it("merges scanner retry metadata with build-upload privacy headers", () => {
    const source = read(
      "apps/web/src/app/api/products/[id]/builds/route.ts",
    );

    expect(source).toContain("function privateJson");
    expect(source).toContain("new Headers(privateHeaders)");
    expect(source).toContain("new Headers(init.headers)");
    expect(source).toContain('"Retry-After": "30"');
    expect(source.match(/privateJson\(/g)?.length).toBeGreaterThan(10);
  });
});
