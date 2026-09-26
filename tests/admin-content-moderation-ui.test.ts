import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("admin content moderation UI", () => {
  it("connects draft content to the existing moderation API", () => {
    const page = read("apps/web/src/app/admin/page.tsx");
    const controls = read(
      "apps/web/src/components/content-moderation-controls.tsx",
    );
    const route = read("apps/web/src/app/api/admin/actions/route.ts");

    expect(page).toContain(
      "<ContentModerationControls contentId={item.id} />",
    );
    expect(controls).toContain('targetType: "content"');
    expect(controls).toContain('moderate("publish")');
    expect(controls).toContain('moderate("archive")');
    expect(controls).toContain('credentials: "same-origin"');
    expect(route).toContain('targetType: z.literal("content")');
    expect(route).toContain('z.enum(["publish", "archive"])');
  });

  it("uses shared locale copy instead of hard-coded moderation labels", () => {
    const page = read("apps/web/src/app/admin/page.tsx");
    const build = read(
      "apps/web/src/components/build-moderation-controls.tsx",
    );
    const verification = read(
      "apps/web/src/components/verification-moderation-controls.tsx",
    );

    expect(page).toContain("getRequestLocale");
    expect(page).toContain("dictionary.admin");
    expect(build).toContain("dictionary.admin");
    expect(verification).toContain("dictionary.admin");
  });
});
