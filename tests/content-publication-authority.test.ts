import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("content publication authority", () => {
  it("defaults submitted content to draft at the validation boundary", () => {
    const validation = read("packages/validation/src/index.ts");

    expect(validation).toContain(
      'status: z.enum(["draft", "published"]).default("draft")',
    );
    expect(validation).not.toContain(
      'status: z.enum(["draft", "published"]).default("published")',
    );
  });

  it("derives community publication on the server instead of trusting the client", () => {
    const route = read("apps/web/src/app/api/content/route.ts");
    const form = read(
      "apps/web/src/components/community-topic-form.tsx",
    );

    expect(route).toContain("const isCommunityTopic =");
    expect(route).toContain(
      'parsed.data.type === "post"',
    );
    expect(route).toContain(
      'parsed.data.type === "question"',
    );
    expect(route).toContain(
      'parsed.data.status === "published"',
    );
    expect(route).toContain(
      'can(user, "admin.moderation")',
    );
    expect(form).not.toContain('status: "published"');
    expect(form).toContain("payload?.success !== true");
  });

  it("keeps authenticated content creation private while discovery remains public", () => {
    const route = read("apps/web/src/app/api/content/route.ts");

    expect(route).toContain(
      '"Cache-Control": "private, no-store"',
    );
    expect(route).toContain('Vary: "Cookie"');
    expect(route).toContain(
      '"public, max-age=30, stale-while-revalidate=120"',
    );
    expect(route).toContain(
      "{ success: true, content: contentItem }",
    );
  });
});
