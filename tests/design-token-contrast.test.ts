import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  resolve(process.cwd(), "apps/web/src/app/globals.css"),
  "utf8",
);

function block(pattern: RegExp): string {
  const match = css.match(pattern);
  expect(match?.[1]).toBeTruthy();
  return match?.[1] ?? "";
}

function token(source: string, name: string): string {
  const match = source.match(
    new RegExp(`\${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`),
  );
  expect(match?.[1], name).toBeTruthy();
  return match?.[1] ?? "#000000";
}

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  ) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((channel) =>
    channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const first = luminance(foreground);
  const second = luminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

const light = block(/:root\\s*\\{([\\s\\S]*?)\\n\\}/u);
const dark = block(/\\.dark\\s*\\{([\\s\\S]*?)\\n\\}/u);
const textTokens = [
  "--nexus-text",
  "--nexus-text-secondary",
  "--nexus-text-muted",
  "--nexus-text-faint",
  "--nexus-accent-text",
] as const;
const surfaceTokens = [
  "--nexus-page",
  "--nexus-surface",
  "--nexus-elevated",
  "--nexus-inset",
  "--nexus-hover",
] as const;

describe("design token contrast", () => {
  for (const [theme, source] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    it(`\${theme} semantic text stays AA-readable on semantic surfaces`, () => {
      for (const textToken of textTokens) {
        for (const surfaceToken of surfaceTokens) {
          expect(
            contrast(token(source, textToken), token(source, surfaceToken)),
            `\${textToken} on \${surfaceToken}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`\${theme} solid accent supports white labels and visible focus`, () => {
      const accent = token(source, "--nexus-accent");
      expect(
        contrast("#ffffff", accent),
        "white on solid accent",
      ).toBeGreaterThanOrEqual(4.5);

      for (const surfaceToken of surfaceTokens) {
        expect(
          contrast(accent, token(source, surfaceToken)),
          `accent focus against \${surfaceToken}`,
        ).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
