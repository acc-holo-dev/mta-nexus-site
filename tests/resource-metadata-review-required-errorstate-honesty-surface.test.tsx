import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surfaces = [
  "apps/web/src/components/resource-build-screen.tsx",
  "apps/web/src/app/workspace/resources/page.tsx",
  "apps/web/src/app/workspace/resources/[id]/page.tsx",
  "apps/web/src/app/workspace/resources/[id]/history/page.tsx",
] as const;

it.each(surfaces)(
  "locks metadata reviewRequired notice to ErrorState without soft text-warning in %s",
  (relative) => {
    const source = read(relative);
    expect(source).toContain("ErrorState");
    expect(source).toContain('id="resource-metadata-review-required"');
    expect(source).toMatch(
      /metadataReviewRequired \? \(\s*<ErrorState[\s\S]*?id="resource-metadata-review-required"/u,
    );
    expect(source).not.toMatch(
      /metadataReviewRequired && \(\s*<p className="(?:mt-2 )?text-sm text-warning">/u,
    );
    expect(source).not.toContain(
      'className="text-sm text-warning">{publisherCopy.reviewRequired}</p>',
    );
    expect(source).not.toContain(
      'className="mt-2 text-sm text-warning">{publisherCopy.reviewRequired}</p>',
    );
    expect(source).not.toContain('className="text-sm text-warning">{copy.reviewRequired}</p>');
  },
);
