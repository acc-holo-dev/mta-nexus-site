import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverySearchApiCopy } from "../../src/features/discovery/discovery-search-api-copy";

/** Wave 65: /api/search error envelope uses bilingual discoverySearchApiCopy, not hard-coded English. */
describe("discovery search API copy honesty surface", () => {
  it("keeps RU/EN search error keys and wires the route through nexus_locale", () => {
    const en = discoverySearchApiCopy("en");
    const ru = discoverySearchApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.unknownType).toBe("Unknown search type");
    expect(ru.unknownType).toBe("Неизвестный тип поиска");
    expect(en.rate).toContain("Search rate limit");
    expect(ru.rate).toContain("лимит поиска");
    expect(en.unavailable).toBe("Search is temporarily unavailable");
    expect(ru.unavailable).toBe("Поиск временно недоступен");
    expect(en.queryTooLong(100)).toContain("100");
    expect(ru.queryTooLong(100)).toContain("100");

    const route = readFileSync(resolve(process.cwd(), "site/src/app/api/search/route.ts"), "utf8");
    expect(route).toContain("discoverySearchApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.queryTooLong(MAX_QUERY_LENGTH)");
    expect(route).toContain("copy.unknownType");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.unavailable");
    expect(route).not.toContain('"Unknown search type"');
    expect(route).not.toContain('"Search rate limit exceeded');
    expect(route).not.toContain('"Search is temporarily unavailable"');
  });
});
