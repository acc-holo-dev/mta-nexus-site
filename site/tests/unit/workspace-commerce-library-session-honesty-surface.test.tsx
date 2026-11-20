import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);

const cart = readFileSync(
  join(root, "site/src/features/commerce/server/cart-workspace-screen.tsx"),
  "utf8",
);
const library = readFileSync(
  join(root, "site/src/features/library/server/library-page-screen.tsx"),
  "utf8",
);
const finance = readFileSync(
  join(root, "site/src/features/commerce/server/workspace-finance-screen.tsx"),
  "utf8",
);
const acquisitions = readFileSync(
  join(root, "site/src/features/resources/server/publisher-acquisitions-screen.tsx"),
  "utf8",
);

const sessionImportFeature = 'import { PlatformSessionError } from "../../shell/session-error"';

/** Honesty lock: cart/library/finance/acquisitions session probe failure → PlatformSessionError. */
it("locks cart/library/finance/acquisitions session probe failure to PlatformSessionError", () => {
  for (const source of [cart, library, finance, acquisitions]) {
    expect(source).toContain(sessionImportFeature);
    expect(source).toMatch(
      /try \{\s*(?:actor|user) = await authService\.getSession\([\s\S]*?\}\s*catch \{[\s\S]*?<PlatformSessionError/u,
    );
    expect(source).toMatch(/if \(!\w+\)[\s\S]*?<PlatformSignIn/u);
    expect(source).not.toMatch(/\.getSession\([^;]*?\)\s*\.catch\(\(\) => null\)/u);
  }

  expect(cart).toContain("title={copy.cart}");
  expect(cart).toContain("message={copy.loadUnavailable}");
  expect(cart).toContain('retryHref="/workspace/cart"');

  expect(library).toContain("title={copy.title}");
  expect(library).toContain("message={copy.loadUnavailable}");
  expect(library).toContain("retryHref={libraryHref(filter, page)}");

  expect(finance).toContain("title={copy.title}");
  expect(finance).toContain("message={copy.statementsLoadUnavailable}");
  expect(finance).toContain("retryHref={returnPath}");

  expect(acquisitions).toContain("title={copy.history}");
  expect(acquisitions).toContain("message={copy.historyLoadUnavailable}");
  expect(acquisitions).toContain("retryHref={retryHref}");
});
