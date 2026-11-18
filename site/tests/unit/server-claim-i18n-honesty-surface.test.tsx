import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const source = readFileSync(
  join(root, "site/src/features/servers/components/server-claim-control-panel.tsx"),
  "utf8",
);
const en = readFileSync(join(root, "site/src/lib/i18n/en/servers.ts"), "utf8");
const ru = readFileSync(join(root, "site/src/lib/i18n/ru/servers.ts"), "utf8");

/** Honesty lock: claim panel identity/unknown strings come from serverClaim i18n. */
it("locks server-claim identity and unknown-result strings to serverClaim dictionary", () => {
  for (const key of [
    "sessionOrStorageUnavailable",
    "sessionChanged",
    "markerSaveFailed",
    "unknownIssueTitle",
    "unknownIssueHint",
    "unknownVerifyTitle",
    "unknownVerifyHint",
    "checkRequests",
    "checkingSession",
  ]) {
    expect(en, key).toContain(`${key}:`);
    expect(ru, key).toContain(`${key}:`);
  }
  expect(source).toContain("sessionOrStorageUnavailable");
  expect(source).toContain("sessionChanged");
  expect(source).toContain("copy.markerSaveFailed");
  expect(source).toContain("copy.unknownIssueTitle");
  expect(source).toContain("copy.checkingSession");
  expect(source).not.toContain("Could not check the session or storage.");
  expect(source).not.toContain("Не удалось проверить сессию или хранилище.");
  expect(source).not.toContain("The session changed or could not be verified.");
});
