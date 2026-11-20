import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { notificationPushApiCopy } from "../../src/features/notifications/notification-push-api-copy";

/** Wave 91: /api/notifications/push errors use bilingual notificationPushApiCopy. */
describe("notification push API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the push route through nexus_locale", () => {
    const en = notificationPushApiCopy("en");
    const ru = notificationPushApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.notConfigured).toContain("Web Push is not configured");
    expect(ru.identityChanged).toContain("Аккаунт или сессия");
    expect(en.registerFailed).toContain("Failed to register");
    expect(ru.removeFailed).toContain("удалить подписку");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/notifications/push/route.ts"),
      "utf8",
    );
    expect(route).toContain("notificationPushApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.invalidEndpointFingerprint");
    expect(route).toContain("copy.readStateFailed");
    expect(route).toContain("copy.notConfigured");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.identityChanged");
    expect(route).toContain("copy.invalidIdentity");
    expect(route).toContain("copy.invalidSubscription");
    expect(route).toContain("copy.endpointConflict");
    expect(route).toContain("copy.sessionLimit");
    expect(route).toContain("copy.registerFailed");
    expect(route).toContain("copy.invalidEndpoint");
    expect(route).toContain("copy.removeFailed");
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Invalid Web Push endpoint fingerprint"');
    expect(route).not.toContain('"Failed to read Web Push state"');
    expect(route).not.toContain('"Web Push is not configured"');
    expect(route).not.toContain('"Too many notification updates. Please try again shortly."');
    expect(route).not.toContain('"Account or session changed. Reload settings."');
    expect(route).not.toContain('"Invalid Web Push identity"');
    expect(route).not.toContain('"Invalid Web Push subscription"');
    expect(route).not.toContain('"Web Push endpoint is already bound to another session"');
    expect(route).not.toContain('"Too many Web Push subscriptions for this session"');
    expect(route).not.toContain('"Failed to register Web Push subscription"');
    expect(route).not.toContain('"Invalid Web Push endpoint"');
    expect(route).not.toContain('"Failed to remove Web Push subscription"');
  });
});
