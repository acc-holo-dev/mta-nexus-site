import { describe, expect, it } from "vitest";
import { updateServerSchema } from "@nexus/validation";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("editorial server metadata", () => {
  it("validates bounded profile links, media, taxonomy and locale fields", () => {
    const migration = read("packages/db/migrations/0008_server_editorial_metadata.sql");

    const url = "https://example.com/image.png";
    expect(
      updateServerSchema.safeParse({
        websiteUrl: url,
        mediaUrls: Array(8).fill(url),
        gameplayTags: ["  racing  "],
        language: "ru",
        region: "EU",
      }),
    ).toMatchObject({ success: true, data: { gameplayTags: ["racing"] } });
    for (const invalid of [
      { mediaUrls: Array(9).fill(url) },
      { mediaUrls: ["javascript:alert(1)"] },
      { websiteUrl: `https://example.com/${"x".repeat(500)}` },
      { gameplayTags: Array(13).fill("racing") },
      { gameplayTags: ["x".repeat(33)] },
      { language: "x".repeat(65) },
      { region: "x".repeat(65) },
    ])
      expect(updateServerSchema.safeParse(invalid).success).toBe(false);
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "media_urls" jsonb');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "gameplay_tags" jsonb');
  });

  it("allows owner edits and keeps metadata separate from official live state", () => {
    const route = read("apps/web/src/app/api/servers/[id]/route.ts");
    const repository = read("packages/db/src/repositories/servers.ts");
    const detail = read("apps/web/src/app/servers/[slug]/page.tsx");

    // PATCH delegates field validation to the shared strict schema.
    expect(route).toContain('import { updateServerSchema } from "@nexus/validation"');
    expect(route).toContain(".strict()");
    expect(
      updateServerSchema.safeParse({
        mediaUrls: ["https://example.com/image.png"],
        gameplayTags: ["race"],
      }).success,
    ).toBe(true);
    expect(repository).toContain("websiteUrl");
    expect(detail).toContain("server.mediaUrls");
    expect(detail).toContain("server.gameplayTags");
    expect(detail).toContain("copy.officialDirectory");
  });
});
