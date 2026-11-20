import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { notificationPreferencesApiCopy } from "../../src/features/notifications/notification-preferences-api-copy";

/** Wave 88: /api/notifications/preferences errors use bilingual notificationPreferencesApiCopy. */
describe("notification preferences API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the preferences route through nexus_locale", () => {
    const en = notificationPreferencesApiCopy("en");
    const ru = notificationPreferencesApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.invalidPreferences).toContain("Invalid notification preferences");
    expect(ru.accountChanged).toContain("Аккаунт изменился");
    expect(en.updateFailed).toContain("Failed to update");
    expect(ru.fetchFailed).toContain("загрузить настройки");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/notifications/preferences/route.ts"),
      "utf8",
    );
    expect(route).toContain("notificationPreferencesApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.fetchFailed");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.invalidPreferences");
    expect(route).toContain("copy.accountChanged");
    expect(route).toContain("copy.updateFailed");
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Failed to fetch notification preferences"');
    expect(route).not.toContain('"Too many preference updates. Please try again shortly."');
    expect(route).not.toContain('"Invalid notification preferences"');
    expect(route).not.toContain('"Account changed. Reload settings."');
    expect(route).not.toContain('"Failed to update notification preferences"');
  });
});
