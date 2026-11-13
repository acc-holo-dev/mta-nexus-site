import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(
  join(root, "site/src/components/resource-compatibility-form.tsx"),
  "utf8",
);

it("locks suspended/blocked product notice to ErrorState without fake retry", () => {
  expect(source).toContain('import { Button, ErrorState, Input } from "@nexus/ui"');
  expect(source).toContain(
    "{product.suspended ? <ErrorState title={copy.errors.PRODUCT_STATE_CHANGED} /> : null}",
  );
  expect(source).not.toContain('className="text-warning">{copy.errors.PRODUCT_STATE_CHANGED}</p>');
  expect(source).toContain(
    "{error ? <ErrorState title={error} description={copy.actionFailedDescription} /> : null}",
  );
});
