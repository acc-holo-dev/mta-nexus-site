import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contentApiCopy } from "../../src/features/community/content-api-copy";

/** Wave 86: /api/content/[slug] errors use bilingual contentApiCopy. */
describe("content API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the content detail route through nexus_locale", () => {
    const en = contentApiCopy("en");
    const ru = contentApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.notFound).toBe("Article not found");
    expect(ru.notFound).toBe("Статья не найдена");
    expect(en.unavailable).toContain("temporarily unavailable");
    expect(ru.unavailable).toContain("временно недоступна");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/content/[slug]/route.ts"),
      "utf8",
    );
    expect(route).toContain("contentApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.notFound");
    expect(route).toContain("copy.unavailable");
    expect(route).not.toContain('"Article not found"');
    expect(route).not.toContain('"Article is temporarily unavailable"');
  });
});
