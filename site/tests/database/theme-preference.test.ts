import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  colorSchemeForTheme,
  nextThemePreference,
  parseThemePreference,
  resolveThemePreference,
} from "../../src/features/shell/theme-preference";

const css = readFileSync(resolve(process.cwd(), "site/src/app/globals.css"), "utf8");

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

  /** Wave 61 / UX-05: native widgets + autofill stay theme-aligned; type roles stay longhand. */
  it("locks native widget color-scheme inherit and autofill to nexus text/inset tokens", () => {
    expect(css).toMatch(/input,\s*select,\s*textarea,\s*button\s*\{\s*color-scheme:\s*inherit;/u);
    expect(css).toContain("-webkit-text-fill-color: var(--nexus-text)");
    expect(css).toContain("caret-color: var(--nexus-text)");
    expect(css).toContain("box-shadow: 0 0 0 1000px var(--nexus-inset) inset");
  });

  it("locks typography utility roles to longhand family/size/weight/line-height", () => {
    for (const role of [".font-display", ".font-heading", ".font-label", ".font-caption"]) {
      expect(css).toMatch(new RegExp(`${role.replace(".", "\\.")}\\s*\\{[^}]*font-family:`, "u"));
      expect(css).not.toMatch(
        new RegExp(`${role.replace(".", "\\.")}\\s*\\{\\s*font:\\s*var\\(`, "u"),
      );
    }
  });
});
