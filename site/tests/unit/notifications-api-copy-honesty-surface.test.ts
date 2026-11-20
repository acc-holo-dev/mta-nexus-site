import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { notificationsApiCopy } from "../../src/features/notifications/notifications-api-copy";

/** Wave 96: /api/notifications GET 500 uses bilingual notificationsApiCopy. */
describe("notifications API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the list route through nexus_locale", () => {
    const en = notificationsApiCopy("en");
    const ru = notificationsApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.fetchFailed).toBe("Failed to fetch notifications");
    expect(ru.fetchFailed).toBe("Не удалось загрузить уведомления");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/notifications/route.ts"),
      "utf8",
    );
    expect(route).toContain("notificationsApiCopy");
    expect(route).toContain("notificationInboxService");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.fetchFailed");
    expect(route).not.toContain("@nexus/db");
    expect(route).not.toContain('"Failed to fetch notifications"');
  });
});
