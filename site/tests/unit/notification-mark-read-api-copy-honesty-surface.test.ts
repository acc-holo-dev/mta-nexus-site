import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { notificationMarkReadApiCopy } from "../../src/features/notifications/notification-mark-read-api-copy";

/** Wave 87: /api/notifications/mark-read errors use bilingual notificationMarkReadApiCopy. */
describe("notification mark-read API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the mark-read route through nexus_locale", () => {
    const en = notificationMarkReadApiCopy("en");
    const ru = notificationMarkReadApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.unauthorized).toBe("Unauthorized");
    expect(ru.unauthorized).toBe("Нет доступа");
    expect(en.invalidTarget).toContain("Invalid notification target");
    expect(ru.accountChanged).toContain("Аккаунт изменился");
    expect(en.markFailed).toContain("Failed to mark");
    expect(ru.markFailed).toContain("отметить уведомления");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/notifications/mark-read/route.ts"),
      "utf8",
    );
    expect(route).toContain("notificationMarkReadApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.unauthorized");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.invalidTarget");
    expect(route).toContain("copy.accountChanged");
    expect(route).toContain("copy.notFound");
    expect(route).toContain("copy.markFailed");
    expect(route).not.toContain('"Unauthorized"');
    expect(route).not.toContain('"Too many notification updates. Please try again shortly."');
    expect(route).not.toContain('"Invalid notification target"');
    expect(route).not.toContain('"Account changed. Reload notifications."');
    expect(route).not.toContain('"Notification not found or not owned by you"');
    expect(route).not.toContain('"Failed to mark notifications read"');
  });
});
