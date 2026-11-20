import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { platformReportsApiCopy } from "../../src/features/moderation/platform-reports-api-copy";

/** Wave 79: workspace platform-reports errors use bilingual platformReportsApiCopy. */
describe("platform reports API copy honesty surface", () => {
  it("keeps RU/EN keys and wires list/detail routes through nexus_locale", () => {
    const en = platformReportsApiCopy("en");
    const ru = platformReportsApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.unauthorized).toBe("Unauthorized");
    expect(ru.unauthorized).toBe("Нет доступа");
    expect(en.invalidPage).toBe("Invalid page");
    expect(ru.notFound).toBe("Не найдено");
    expect(en.listFailed).toContain("platform reports");
    expect(ru.detailFailed).toContain("platform-отчёт");

    for (const relative of [
      "site/src/app/api/workspace/platform-reports/route.ts",
      "site/src/app/api/workspace/platform-reports/[id]/route.ts",
    ]) {
      const route = readFileSync(resolve(process.cwd(), relative), "utf8");
      expect(route).toContain("platformReportsApiCopy");
      expect(route).toContain("resolveLocale");
      expect(route).toContain("nexus_locale");
      expect(route).toContain("copy.unauthorized");
      expect(route).not.toContain('"Unauthorized"');
    }

    const list = readFileSync(
      resolve(process.cwd(), "site/src/app/api/workspace/platform-reports/route.ts"),
      "utf8",
    );
    expect(list).toContain("copy.invalidPage");
    expect(list).toContain("copy.listFailed");
    expect(list).not.toContain('"Invalid page"');
    expect(list).not.toContain('"Failed to load platform reports"');

    const detail = readFileSync(
      resolve(process.cwd(), "site/src/app/api/workspace/platform-reports/[id]/route.ts"),
      "utf8",
    );
    expect(detail).toContain("copy.notFound");
    expect(detail).toContain("copy.detailFailed");
    expect(detail).not.toContain('"Not found"');
    expect(detail).not.toContain('"Failed to load platform report"');
  });
});
