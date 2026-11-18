import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { serverClaimApiCopy } from "../../src/features/servers/server-claim-api-copy";

/** Wave 77: claim-challenge (+ verify) errors use bilingual serverClaimApiCopy. */
describe("server claim API copy honesty surface", () => {
  it("keeps RU/EN keys and wires claim-challenge routes through nexus_locale", () => {
    const en = serverClaimApiCopy("en");
    const ru = serverClaimApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.authenticationRequired).toBe("Authentication required");
    expect(ru.authenticationRequired).toBe("Требуется вход");
    expect(en.invalidProof).toContain("Invalid server control proof");
    expect(ru.invalidProof).toContain("доказательство");
    expect(en.createFailed).toContain("Could not create");
    expect(ru.verifyFailed).toContain("проверить контроль");

    for (const relative of [
      "site/src/app/api/servers/[id]/claim-challenge/route.ts",
      "site/src/app/api/servers/[id]/claim-challenge/verify/route.ts",
    ]) {
      const route = readFileSync(resolve(process.cwd(), relative), "utf8");
      expect(route).toContain("serverClaimApiCopy");
      expect(route).toContain("resolveLocale");
      expect(route).toContain("nexus_locale");
      expect(route).toContain("copy.authenticationRequired");
      expect(route).toContain("copy.actorRequired");
      expect(route).toContain("copy.accountChanged");
      expect(route).toContain("copy.rate");
      expect(route).toContain("copy.serverNotFound");
      expect(route).toContain("copy.retry");
      expect(route).not.toContain('"Authentication required"');
      expect(route).not.toContain('"Actor precondition required"');
      expect(route).not.toContain('"Account changed"');
      expect(route).not.toContain('"Too many server control proof attempts"');
      expect(route).not.toContain('"Server not found"');
      expect(route).not.toContain('"Please retry the server claim"');
    }

    const create = readFileSync(
      resolve(process.cwd(), "site/src/app/api/servers/[id]/claim-challenge/route.ts"),
      "utf8",
    );
    expect(create).toContain("copy.createFailed");
    expect(create).not.toContain('"Could not create server control challenge"');

    const verify = readFileSync(
      resolve(process.cwd(), "site/src/app/api/servers/[id]/claim-challenge/verify/route.ts"),
      "utf8",
    );
    expect(verify).toContain("copy.invalidProof");
    expect(verify).toContain("copy.verifyFailed");
    expect(verify).not.toContain('"Invalid server control proof"');
    expect(verify).not.toContain('"Could not verify server control"');
  });
});
