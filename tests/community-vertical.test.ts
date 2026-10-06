import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("community vertical", () => {
  it("publishes bounded user topics while keeping editorial content moderated", () => {
    const route = read("apps/web/src/app/api/content/route.ts");
    const repository = read(
      "packages/db/src/repositories/content.ts",
    );

    expect(route).toContain("const isCommunityTopic =");
    expect(route).toContain('parsed.data.type === "post"');
    expect(route).toContain('parsed.data.type === "question"');
    expect(route).toContain('can(user, "admin.moderation")');
    expect(repository).toContain("listPublishedByTypes");
    expect(repository).toContain("inArray(content.type, types)");
  });

  it("exposes topic discovery, creation and the existing discussion path", () => {
    const page = read("apps/web/src/app/community/page.tsx");
    const form = read(
      "apps/web/src/components/community-topic-form.tsx",
    );
    const sidebar = read("apps/web/src/components/sidebar.tsx");

    expect(page).toContain("listCommunityTopics");
    expect(form).toContain('fetch("/api/content"');
    expect(form).not.toContain('status: "published"');
    expect(form).toContain("payload?.success !== true");
    const dollar = "$";
    expect(form).toContain(
      `/articles/${dollar}{encodeURIComponent(payload.content.slug)}`,
    );
    expect(sidebar).toContain('href: "/community"');
    expect(sidebar).toContain(
      "label: dictionary.nav.community",
    );
  });
});
