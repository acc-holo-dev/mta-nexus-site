import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("private authenticated mutation responses", () => {
  it.each([
    "apps/web/src/app/api/auth/context/route.ts",
    "apps/web/src/app/api/verification/route.ts",
    "apps/web/src/app/api/notifications/preferences/route.ts",
  ])("%s uses one private no-store response contract", (path) => {
    const source = read(path);

    expect(source).toContain('"Cache-Control": "private, no-store"');
    expect(source).toContain('Vary: "Cookie"');
    expect(source).toContain("headers: privateHeaders");
  });

  it("keeps context switching non-optimistic", () => {
    const source = read(
      "apps/web/src/components/context-switcher.tsx",
    );

    const requestStart = source.indexOf(
      'fetch("/api/auth/context"',
    );
    const confirmation = source.indexOf(
      "data?.success !== true",
    );
    const stateUpdate = source.indexOf(
      "setActiveContextId(data.activeContextId)",
    );

    expect(requestStart).toBeGreaterThan(-1);
    expect(confirmation).toBeGreaterThan(requestStart);
    expect(stateUpdate).toBeGreaterThan(confirmation);
    expect(source).not.toContain(
      "setActiveContextId(contextId);",
    );
  });
});
