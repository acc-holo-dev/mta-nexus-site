import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "apps/web/src/components/build-package-evidence.tsx"),
  "utf8",
);

it("locks truncated reference notices to ErrorState without fake retry", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain('id="build-package-evidence-refs-truncated"');
  expect(source).toContain('id="build-package-evidence-manifest-refs-truncated"');
  expect(source).toContain("title={copy.truncated}");
  expect(source).not.toContain('className="text-warning">{copy.truncated}</p>');
  expect(source).not.toMatch(/referencesTruncated[\s\S]{0,120}onClick|action=/u);
});

it("locks residual missing/unknown evidence soft warnings to ErrorState", () => {
  expect(source).toContain('id="build-package-evidence-missing-refs"');
  expect(source).toMatch(
    /title=\{`\$\{copy\.references\}: \$\{copy\.absent\} \$\{summary\.missingReferences\} · \$\{copy\.unknown\} \$\{summary\.unresolvedReferences\}`\}/u,
  );
  expect(source).toMatch(
    /id=\{`build-package-evidence-ref-\$\{v\.kind\}-\$\{v\.status\}-\$\{v\.path \|\| "empty"\}`\}/u,
  );
  expect(source).toMatch(/id=\{`build-package-evidence-issue-\$\{v\.code\}`\}/u);
  expect(source).toContain("<ErrorState");
  expect(source).not.toContain('className="text-warning"');
  expect(source).not.toContain(
    'className={v.status === "present" ? "text-success" : "text-warning"}',
  );
  expect(source).not.toContain("list-inside list-disc text-warning");
  expect(source).not.toMatch(/ErrorState[\s\S]{0,80}action=/u);
});
