import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server update feed surface", () => {
  it("keeps public server updates on moderated content types only", () => {
    const repository = read(
      "packages/db/src/repositories/content.ts",
    );

    expect(repository).toContain("listPublishedByServer");
    expect(repository).toContain('"article"');
    expect(repository).toContain('"news"');
    expect(repository).toContain('"devlog"');
    expect(repository).toContain('"update"');
    expect(repository).toContain('"announcement"');
    expect(repository).toContain('eq(content.status, "published")');
    expect(repository).toContain("inArray(content.type, publicServerUpdateTypes)");
    expect(repository).not.toContain(
      'publicServerUpdateTypes: Content["type"][] = ["post"',
    );
  });

  it("loads official directory status and content feed in parallel", () => {
    const page = read("apps/web/src/app/servers/[slug]/page.tsx");

    expect(page).toContain("const [directory, serverUpdates] = await Promise.all([");
    expect(page).toContain("mtaMasterDirectoryService.getDirectory().catch(() => null)");
    expect(page).toContain("contentService.listServerUpdates(server.id, 6).catch(() => null)");
    expect(page).toContain("<ServerUpdatesPanel updates={serverUpdates} />");
  });

  it("distinguishes empty and unavailable update feeds", () => {
    const panel = read(
      "apps/web/src/components/server-updates-panel.tsx",
    );

    expect(panel).toContain("Server updates are temporarily unavailable");
    expect(panel).toContain("No published server updates yet");
    expect(panel).toContain("Moderated content");
    expect(panel).toContain("<ArticleCard");
  });
});
