import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("content discussion form", () => {
  it("connects the published article surface to the protected comments API", () => {
    const page = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/articles/[slug]/page.tsx"),
      "utf8"
    );
    const form = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/content-comment-form.tsx"),
      "utf8"
    );

    expect(page).toContain("<ContentCommentForm slug={article.slug} />");
    const dollar = "$";
    expect(form).toContain(`/api/content/${dollar}{encodeURIComponent(slug)}/comments`);
    expect(form).toContain('method: "POST"');
    expect(form).toContain("payload?.comment?.id");
    expect(form).toContain("router.refresh()");
    expect(form).toContain("maxLength={5000}");
  });
});
