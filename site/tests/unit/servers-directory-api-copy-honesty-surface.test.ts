import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { serversDirectoryApiCopy } from "../../src/features/servers/servers-directory-api-copy";

/** Wave 66: /api/servers/directory errors use bilingual serversDirectoryApiCopy. */
describe("servers directory API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the directory route through nexus_locale", () => {
    const en = serversDirectoryApiCopy("en");
    const ru = serversDirectoryApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.invalidQuery).toBe("Invalid directory query");
    expect(ru.invalidQuery).toBe("Некорректный запрос каталога");
    expect(en.unavailable).toContain("temporarily unavailable");
    expect(ru.unavailable).toContain("временно недоступен");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/servers/directory/route.ts"),
      "utf8",
    );
    expect(route).toContain("serversDirectoryApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.invalidQuery");
    expect(route).toContain("copy.unavailable");
    expect(route).not.toContain('"Invalid directory query"');
    expect(route).not.toContain('"The official MTA server directory is temporarily unavailable"');
  });
});
