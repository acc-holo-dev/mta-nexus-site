import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "site/src/components/register-server-form.tsx"), "utf8");

it("routes organization lookup outages through ErrorState with touch retry", () => {
  expect(source).toContain(
    'import { Button, ErrorState, fieldControlClass, Input } from "@nexus/ui"',
  );
  expect(source).toMatch(
    /organizationsFailed \? \(\s*<ErrorState[\s\S]*?title=\{copy\.organizationsUnavailable\}[\s\S]*?size="touch"[\s\S]*?setOrganizationsLoadAttempt[\s\S]*?\{dictionary\.errors\.retry\}/u,
  );
  expect(source).not.toContain('role="status" className="block text-xs text-muted"');
  expect(source).not.toMatch(
    /organizationsFailed && \(\s*<span role="status"[\s\S]*?\{copy\.organizationsUnavailable\}/u,
  );
  expect(source).toMatch(
    /error \? \(\s*<ErrorState[\s\S]*?title=\{error\}[\s\S]*?description=\{message\(/u,
  );
  expect(source).not.toContain('role="alert"');
});
