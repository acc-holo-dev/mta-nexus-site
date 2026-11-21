import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Wave 59: first viewport = brand + one headline + one support + CTA; no eyebrow. */
it("locks Home hero budget without liveEcosystem eyebrow", () => {
  const page = read("site/src/features/shell/server/home-page.tsx");
  const en = read("site/src/lib/i18n/en/discovery.ts");
  const ru = read("site/src/lib/i18n/ru/discovery.ts");
  expect(page).toContain("nexus-hero-atmosphere");
  expect(page).toContain("dictionary.home.brand");
  expect(page).toContain("dictionary.home.title");
  expect(page).toContain("dictionary.home.walletTitle");
  expect(page).toContain("dictionary.home.description");
  expect(page).toContain("dictionary.home.walletDescription");
  expect(page).toContain("dictionary.home.exploreServers");
  expect(page).toContain("dictionary.home.browseResources");
  expect(page).toContain("<Rise");
  expect(page).not.toContain("liveEcosystem");
  expect(en).not.toContain("liveEcosystem");
  expect(ru).not.toContain("liveEcosystem");
});
