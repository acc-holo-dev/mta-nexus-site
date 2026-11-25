import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/servers/server/server-detail-screen.tsx"),
  "utf8",
);

/** Honesty lock: a failed official directory read is not "no observation". */
it("locks server detail directory load failure to ErrorState", () => {
  expect(source).toContain('id="server-directory-unavailable"');
  expect(source).toContain("dictionary.servers.unavailable");
  expect(source).toContain("dictionary.servers.unavailableHint");
  expect(source).toMatch(
    /!directory \? \(\s*<ErrorState[\s\S]*?id="server-directory-unavailable"[\s\S]*?\) : !observedServer \? \([\s\S]*?\{copy\.noObservation\}/u,
  );
  expect(source).not.toMatch(/\{!observedServer &&[\s\S]*?copy\.noObservation/u);
});
