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
    for (const type of [
      '"article"',
      '"news"',
      '"devlog"',
      '"update"',
      '"announcement"',
    ]) {
      expect(repository).toContain(type);
    }
    expect(repository).toContain(
      'eq(content.status, "published")',
    );
    expect(repository).toContain(
      "inArray(content.type, publicServerUpdateTypes)",
    );
    expect(repository).toContain(
      String.raw`coalesce(\${content.publishedAt}, \${content.updatedAt})`,
    );
    expect(repository).not.toContain(
      'publicServerUpdateTypes: Content["type"][] = ["post"',
    );
  });

  it("loads official directory status, history and content feed in parallel", () => {
    const page = read(
      "apps/web/src/app/servers/[slug]/page.tsx",
    );

    expect(page).toContain(
      "const [directory, history, serverUpdates] = await Promise.all([",
    );
    expect(page).toContain(
      "mtaMasterDirectoryService.getDirectory().catch(() => null)",
    );
    expect(page).toContain(
      "contentService.listServerUpdates(server.id, 6).catch(() => null)",
    );
    expect(page).toContain("<ServerUpdatesPanel");
    expect(page).toContain("updates={serverUpdates}");
    expect(page).toContain("locale={locale}");
  });

  it("distinguishes empty and unavailable update feeds through locale copy", () => {
    const panel = read(
      "apps/web/src/components/server-updates-panel.tsx",
    );

    expect(panel).toContain(
      "getDictionary(locale).serverUpdates",
    );
    expect(panel).toContain("copy.unavailable");
    expect(panel).toContain("copy.empty");
    expect(panel).toContain("copy.moderated");
    expect(panel).toContain("<ArticleCard");
  });
});
