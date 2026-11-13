import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surfaces = [
  "site/src/components/support-page.tsx",
  "site/src/components/support-center.tsx",
] as const;

it.each(surfaces)(
  "locks support noGuaranteedSla notice to ErrorState without soft text-warning in %s",
  (relative) => {
    const source = read(relative);
    expect(source).toContain("ErrorState");
    expect(source).toContain('id="support-no-guaranteed-sla"');
    expect(source).toMatch(
      /<ErrorState\s+id="support-no-guaranteed-sla"\s+title=\{(?:support|copy)\.noGuaranteedSla\}/u,
    );
    expect(source).not.toContain('className="text-xs text-warning">{support.noGuaranteedSla}</p>');
    expect(source).not.toContain('className="text-xs text-warning">{copy.noGuaranteedSla}</p>');
  },
);
