import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { serversApiCopy } from "../../src/features/servers/servers-api-copy";

/** Waves 83/90: /api/servers collection + PATCH detail errors use bilingual serversApiCopy. */
describe("servers API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the servers collection route through nexus_locale", () => {
    const en = serversApiCopy("en");
    const ru = serversApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.listingsUnavailable).toContain("temporarily unavailable");
    expect(ru.listingsUnavailable).toContain("недоступен");
    expect(en.registerFailed).toContain("Could not register");
    expect(ru.registerFailed).toContain("зарегистрировать");
    expect(en.updateLimitExceeded).toContain("Server update limit exceeded");
    expect(ru.updateFailed).toContain("обновить сервер");

    const route = readFileSync(resolve(process.cwd(), "site/src/app/api/servers/route.ts"), "utf8");
    expect(route).toContain("serversApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.listingsUnavailable");
    expect(route).toContain("copy.registrationLimitExceeded");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.actorRequired");
    expect(route).toContain("copy.actorChanged");
    expect(route).toContain("copy.invalidCreationNonce");
    expect(route).toContain("copy.invalidServerDetails");
    expect(route).toContain("copy.registerFailed");
    expect(route).toContain("localeAppErrorText");
    expect(route).not.toContain("error.message");
    expect(route).not.toContain('"Server listings are temporarily unavailable"');
    expect(route).not.toContain('"Server registration limit exceeded"');
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Actor precondition required"');
    expect(route).not.toContain('"Actor changed"');
    expect(route).not.toContain('"Invalid creation nonce"');
    expect(route).not.toContain('"Invalid server details"');
    expect(route).not.toContain('"Could not register server"');
  });

  it("wires /api/servers/[id] PATCH through nexus_locale", () => {
    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/servers/[id]/route.ts"),
      "utf8",
    );
    expect(route).toContain("serversApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.updateLimitExceeded");
    expect(route).toContain("copy.invalidServerDetails");
    expect(route).toContain("copy.updateFailed");
    expect(route).toContain("localeAppErrorText");
    expect(route).not.toContain("error.message");
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Server update limit exceeded"');
    expect(route).not.toContain('"Invalid server details"');
    expect(route).not.toContain('"Could not update server"');
  });
});
