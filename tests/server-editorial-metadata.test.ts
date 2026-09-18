import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("editorial server metadata", () => {
  it("validates bounded profile links, media, taxonomy and locale fields", () => {
    const validation = readFileSync(
      resolve(process.cwd(), "packages/validation/src/index.ts"),
      "utf8"
    );
    const migration = readFileSync(
      resolve(process.cwd(), "packages/db/migrations/0008_server_editorial_metadata.sql"),
      "utf8"
    );

    expect(validation).toContain("mediaUrls: z.array(z.string().url().max(500)).max(8).default([])");
    expect(validation).toContain("gameplayTags: z.array(z.string().trim().min(1).max(32)).max(12).default([])");
    expect(validation).toContain("websiteUrl: z.string().url().max(500)");
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "media_urls" jsonb');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "gameplay_tags" jsonb');
  });

  it("allows owner edits and keeps metadata separate from official live state", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/servers/[id]/route.ts"),
      "utf8"
    );
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/servers.ts"),
      "utf8"
    );
    const detail = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/servers/[slug]/page.tsx"),
      "utf8"
    );

    expect(route).toContain("mediaUrls");
    expect(route).toContain("gameplayTags");
    expect(repository).toContain("websiteUrl");
    expect(detail).toContain("server.mediaUrls");
    expect(detail).toContain("server.gameplayTags");
    expect(detail).toContain("official MTA directory");
  });
});
