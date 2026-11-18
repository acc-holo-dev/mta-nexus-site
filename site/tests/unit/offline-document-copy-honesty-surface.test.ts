import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { GET as getServiceWorker } from "../../src/app/sw.js/route";
import {
  offlineDocumentCopy,
  offlineDocumentTheme,
} from "../../src/features/shell/offline-document-copy";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("owns offline document bilingual strings and dark theme literals in Shell", () => {
  const port = read("site/src/features/shell/offline-document-copy.ts");
  expect(port).toContain("export const offlineDocumentCopy");
  expect(port).toContain("export const offlineDocumentTheme");
  expect(port).toContain(offlineDocumentCopy.en.title);
  expect(port).toContain(offlineDocumentCopy.ru.title);
  expect(port).toContain(offlineDocumentCopy.en.pushFallbackBody);
  expect(port).toContain(offlineDocumentCopy.ru.pushFallbackBody);
  expect(port).toContain(offlineDocumentTheme.page);
  expect(port).toContain(offlineDocumentTheme.fontDisplay);
  expect(port).toContain('brand: "MTA NEXUS"');
});

it("injects offline copy + theme into the service worker without route-owned sentences", async () => {
  const route = read("site/src/app/sw.js/route.ts");
  expect(route).toContain("offlineDocumentCopy");
  expect(route).toContain("offlineDocumentTheme");
  expect(route).toContain("OFFLINE_COPY[locale]");
  expect(route).toContain("OFFLINE_THEME");
  expect(route).toContain("pushFallbackBody");
  expect(route).not.toContain('russian ? "MTA NEXUS — нет сети"');
  expect(route).not.toContain("You have a new notification.");
  expect(route).not.toContain("NEXUS never confirms purchases, publishing, moderation");
  expect(route).not.toContain("#09090b");
  expect(route).not.toContain("system-ui,sans-serif");

  const source = await getServiceWorker().text();
  expect(source).toContain(`const OFFLINE_COPY = ${JSON.stringify(offlineDocumentCopy)}`);
  expect(source).toContain(`const OFFLINE_THEME = ${JSON.stringify(offlineDocumentTheme)}`);
  expect(source).toContain(offlineDocumentCopy.en.pushFallbackBody);
  expect(source).toContain(offlineDocumentCopy.ru.pushFallbackBody);
  expect(source).toContain(offlineDocumentTheme.page);
  expect(source).toContain("Source Sans 3");
  expect(source).toContain("Unbounded");
});
