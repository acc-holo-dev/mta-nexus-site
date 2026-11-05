import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "apps/web/src/components/build-package-evidence.tsx"),
  "utf8",
);

it("locks truncated reference notices to ErrorState without fake retry", () => {
  expect(source).toContain('import { ErrorState } from "@nexus/ui"');
  expect(source).toContain(
    "{summary.referencesTruncated ? <ErrorState title={copy.truncated} /> : null}",
  );
  expect(source).toContain(
    "{manifest.referencesTruncated ? <ErrorState title={copy.truncated} /> : null}",
  );
  expect(source).not.toContain('className="text-warning">{copy.truncated}</p>');
  expect(source).not.toMatch(/referencesTruncated[\s\S]{0,80}onClick|action=/u);
});
