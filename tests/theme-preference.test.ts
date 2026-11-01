import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  colorSchemeForTheme,
  nextThemePreference,
  parseThemePreference,
  resolveThemePreference,
} from "../apps/web/src/lib/theme-preference";

const css = readFileSync(resolve(process.cwd(), "apps/web/src/app/globals.css"), "utf8");

describe("theme preference", () => {
  it("treats missing and invalid stored values as system preference", () => {
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference(undefined)).toBe("system");
    expect(parseThemePreference("legacy")).toBe("system");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("system")).toBe("system");
  });

  it("resolves system preference from the current OS color scheme", () => {
    expect(resolveThemePreference("system", true)).toBe("dark");
    expect(resolveThemePreference("system", false)).toBe("light");
    expect(resolveThemePreference("dark", false)).toBe("dark");
    expect(resolveThemePreference("light", true)).toBe("light");
  });

  it("cycles through all three user-selectable modes", () => {
    expect(nextThemePreference("system")).toBe("light");
    expect(nextThemePreference("light")).toBe("dark");
    expect(nextThemePreference("dark")).toBe("system");
  });

  it("maps resolved theme to CSS color-scheme and keeps stylesheet tokens aligned", () => {
    expect(colorSchemeForTheme("light")).toBe("light");
    expect(colorSchemeForTheme("dark")).toBe("dark");
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light;/u);
    expect(css).toMatch(/\.dark\s*\{[^}]*color-scheme:\s*dark;/u);
    expect(css).toContain("font-family:");
    expect(css).not.toMatch(/\.font-heading\s*\{\s*font:\s*var\(--font-heading\)/u);
  });
});
