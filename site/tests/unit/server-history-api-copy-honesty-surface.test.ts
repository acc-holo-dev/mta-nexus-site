import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { serverHistoryApiCopy } from "../../src/features/servers/server-history-api-copy";

/** Wave 85: /api/servers/[id]/history errors use bilingual serverHistoryApiCopy. */
describe("server history API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the history route through nexus_locale", () => {
    const en = serverHistoryApiCopy("en");
    const ru = serverHistoryApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.invalidWindow).toBe("Invalid history window");
    expect(ru.invalidWindow).toBe("Некорректное окно истории");
    expect(en.serverNotFound).toBe("Server not found");
    expect(ru.serverNotFound).toBe("Сервер не найден");
    expect(en.unavailable).toContain("temporarily unavailable");
    expect(ru.unavailable).toContain("временно недоступна");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/servers/[id]/history/route.ts"),
      "utf8",
    );
    expect(route).toContain("serverHistoryApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.invalidWindow");
    expect(route).toContain("copy.serverNotFound");
    expect(route).toContain("copy.unavailable");
    expect(route).not.toContain('"Invalid history window"');
    expect(route).not.toContain('"Server not found"');
    expect(route).not.toContain('"Server history is temporarily unavailable"');
  });
});
