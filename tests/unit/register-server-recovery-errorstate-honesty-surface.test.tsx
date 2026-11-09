import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

/** Honesty lock for register-server recovery/inconclusive ErrorState. */
let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const surface = "apps/web/src/components/register-server-form.tsx";

it("locks register-server recovery and inconclusive notices to ErrorState", () => {
  const source = read(surface);
  expect(source).toContain("ErrorState");
  expect(source).toContain('id="register-server-session-recovery"');
  expect(source).toContain('id="register-server-create-inconclusive"');
  expect(source).not.toContain('{recoveryMessage ? <p role="status">{recoveryMessage}</p> : null}');
  expect(source).not.toContain(
    "The creation result is unknown. Your draft is saved and creating another is blocked.</p>",
  );
});
