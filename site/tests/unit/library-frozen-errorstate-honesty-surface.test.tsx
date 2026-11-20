import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surfaces = [
  {
    path: "site/src/features/library/components/library-collection-import.tsx",
    id: "library-collection-import-frozen",
  },
  {
    path: "site/src/features/library/components/library-selection-batch-controls.tsx",
    id: "library-selection-batch-frozen",
  },
  {
    path: "site/src/features/library/components/library-collection-reconcile.tsx",
    id: "library-collection-reconcile-frozen",
  },
  {
    path: "site/src/features/library/components/library-collection-batch.tsx",
    id: "library-collection-batch-frozen",
  },
  {
    path: "site/src/features/library/components/library-membership-batch.tsx",
    id: "library-membership-batch-frozen",
  },
  {
    path: "site/src/features/library/components/library-collection-command.tsx",
    id: "library-collection-command-frozen",
  },
  {
    path: "site/src/features/library/components/library-collection-item-copy.tsx",
    id: "library-collection-item-copy-frozen",
  },
] as const;

/** Honesty lock: library frozen/unknown-result markers use ErrorState, not soft notes. */
it("locks library frozen recovery markers to ErrorState with stable ids", () => {
  for (const surface of surfaces) {
    const source = read(surface.path);
    expect(source, surface.path).toContain(`id="${surface.id}"`);
    expect(source, surface.path).toContain("ErrorState");
    expect(source, surface.path).toMatch(
      new RegExp(
        `<ErrorState[\\s\\S]*?id="${surface.id}"[\\s\\S]*?title=\\{(?:m|c)\\.frozen\\}`,
        "u",
      ),
    );
    expect(source, surface.path).toMatch(
      new RegExp(
        `id="${surface.id}"[\\s\\S]*?description=\\{(?:m|c)\\.(?:retry|actionErrorDescription)\\}`,
        "u",
      ),
    );
    expect(source, surface.path).not.toMatch(/frozen &&[^;]*role="note"/u);
    expect(source, surface.path).not.toMatch(/\{frozen && <p role="note">/u);
  }
});
