import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { GET as getServiceWorker } from "../../src/app/sw.js/route";
import { offlineDocumentCopy } from "../../src/features/shell/offline-document-copy";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

it("owns offline document bilingual strings in the shell copy module", () => {
  const port = read("site/src/features/shell/offline-document-copy.ts");
  expect(port).toContain("export const offlineDocumentCopy");
  expect(port).toContain(offlineDocumentCopy.en.title);
  expect(port).toContain(offlineDocumentCopy.ru.title);
  expect(port).toContain(offlineDocumentCopy.en.heading);
  expect(port).toContain(offlineDocumentCopy.ru.heading);
  expect(port).toContain(offlineDocumentCopy.en.body);
  expect(port).toContain(offlineDocumentCopy.ru.body);
  expect(port).toContain(offlineDocumentCopy.en.retry);
  expect(port).toContain(offlineDocumentCopy.ru.retry);
  expect(port).toContain('brand: "MTA NEXUS"');
});

it("injects offlineDocumentCopy into the service-worker source from GET()", async () => {
  const route = read("site/src/app/sw.js/route.ts");
  expect(route).toContain('from "../../features/shell/offline-document-copy"');
  expect(route).toContain("JSON.stringify(offlineDocumentCopy)");
  expect(route).toContain("OFFLINE_COPY[locale]");
  expect(route).not.toContain('russian ? "MTA NEXUS — нет сети"');
  expect(route).not.toContain('russian ? "Нет подключения к сети"');
  expect(route).not.toContain("NEXUS never confirms purchases, publishing, moderation");
  expect(route).not.toContain("NEXUS не подтверждает покупки, публикации, модерацию");

  const source = await getServiceWorker().text();
  expect(source).toContain(`const OFFLINE_COPY = ${JSON.stringify(offlineDocumentCopy)}`);
  expect(source).toContain(offlineDocumentCopy.en.body);
  expect(source).toContain(offlineDocumentCopy.ru.body);
  expect(source).toContain(offlineDocumentCopy.en.heading);
  expect(source).toContain(offlineDocumentCopy.ru.heading);
  expect(source).toContain(offlineDocumentCopy.en.retry);
  expect(source).toContain(offlineDocumentCopy.ru.retry);
  expect(source).toContain('"brand":"MTA NEXUS"');
});
