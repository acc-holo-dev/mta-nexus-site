import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const resourceBrowserAcceptance = Object.freeze({
  playwrightSpecs: Object.freeze([
    "scripts/tests/resource-claim-download.playwright.mjs",
    "scripts/tests/author-workspace.playwright.mjs",
    "scripts/tests/shell-accessibility.playwright.mjs",
    "scripts/tests/public-portfolio.playwright.mjs",
  ]),
  fixture: Object.freeze({
    initialEntitlements: 0,
    productStatus: "published",
    buildStatus: "published",
    scanStatus: "clean",
  }),
  postconditions: Object.freeze({
    entitlements: 1,
    salesCount: 1,
  }),
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(resourceBrowserAcceptance));
}
