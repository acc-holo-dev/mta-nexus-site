import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { serversDirectoryApiCopy } from "../../src/features/servers/servers-directory-api-copy";

/** Wave 66 directory + Wave 84 mta/servers: bilingual serversDirectoryApiCopy. */
describe("servers directory API copy honesty surface", () => {
  it("keeps RU/EN keys and wires directory routes through nexus_locale", () => {
    const en = serversDirectoryApiCopy("en");
    const ru = serversDirectoryApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.invalidQuery).toBe("Invalid directory query");
    expect(ru.invalidQuery).toBe("Некорректный запрос каталога");
    expect(en.unavailable).toContain("temporarily unavailable");
    expect(ru.unavailable).toContain("временно недоступен");
    expect(en.mtaUnavailable).toBe("MTA server directory is temporarily unavailable");
    expect(ru.mtaUnavailable).toContain("Каталог серверов MTA");

    const directory = readFileSync(
      resolve(process.cwd(), "site/src/app/api/servers/directory/route.ts"),
      "utf8",
    );
    expect(directory).toContain("serversDirectoryApiCopy");
    expect(directory).toContain("resolveLocale");
    expect(directory).toContain("nexus_locale");
    expect(directory).toContain("copy.invalidQuery");
    expect(directory).toContain("copy.unavailable");
    expect(directory).not.toContain('"Invalid directory query"');
    expect(directory).not.toContain(
      '"The official MTA server directory is temporarily unavailable"',
    );

    const mta = readFileSync(
      resolve(process.cwd(), "site/src/app/api/mta/servers/route.ts"),
      "utf8",
    );
    expect(mta).toContain("serversDirectoryApiCopy");
    expect(mta).toContain("resolveLocale");
    expect(mta).toContain("nexus_locale");
    expect(mta).toContain("copy.mtaUnavailable");
    expect(mta).not.toContain('"MTA server directory is temporarily unavailable"');
  });
});
