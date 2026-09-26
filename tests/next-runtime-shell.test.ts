import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("Next.js root runtime shell", () => {
  it("uses next/script for the pre-hydration theme bootstrap", () => {
    const layout = read("apps/web/src/app/layout.tsx");

    expect(layout).toContain('import Script from "next/script"');
    expect(layout).toContain('id="nexus-theme-init"');
    expect(layout).toContain('strategy="beforeInteractive"');
    expect(layout).toContain(
      "dangerouslySetInnerHTML={{ __html: themeInitScript }}",
    );
    expect(layout).not.toContain("<script ");
  });

  it("has a self-contained root-layout error boundary", () => {
    const globalError = read(
      "apps/web/src/app/global-error.tsx",
    );

    expect(globalError).toContain('"use client"');
    expect(globalError).toContain("<html lang={locale}>");
    expect(globalError).toContain("<body");
    expect(globalError).toContain("nexus_locale=ru");
    expect(globalError).toContain("onClick={reset}");
    expect(globalError).not.toContain("useNexusLocale");
  });

  it("keeps regular error and not-found actions keyboard visible", () => {
    const error = read("apps/web/src/app/error.tsx");
    const notFound = read("apps/web/src/app/not-found.tsx");

    expect(error).toContain("focus-visible:outline-2");
    expect(notFound).toContain("focus-visible:outline-2");
    expect(notFound.match(/aria-hidden="true"/g)?.length).toBeGreaterThanOrEqual(
      3,
    );
  });
});
