import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/** Wave 63: search server empty descriptions use serverDetail.serverFallback, not English "Server". */
it("locks discovery search server fallback to dictionary + locale from search route", () => {
  const service = read("site/src/lib/services/discovery/discovery-service.ts");
  const route = read("site/src/app/api/search/route.ts");
  const en = read("site/src/lib/i18n/en/servers.ts");
  const ru = read("site/src/lib/i18n/ru/servers.ts");
  expect(en).toContain('serverFallback: "MTA server"');
  expect(ru).toContain('serverFallback: "Сервер MTA"');
  expect(service).toContain("serverDetail.serverFallback");
  expect(service).toContain("locale: Locale");
  expect(service).not.toContain('|| "MTA"} Server');
  expect(service).not.toContain('"MTA"} Server');
  expect(route).toContain("resolveLocale");
  expect(route).toContain("nexus_locale");
  expect(route).toContain("discoveryService.search(query, limit, type || undefined, locale)");
});
