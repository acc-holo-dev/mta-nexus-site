import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { verificationApiCopy } from "../../src/features/trust/verification-api-copy";

/** Wave 92: /api/verification errors use bilingual verificationApiCopy. */
describe("verification API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the verification route through nexus_locale", () => {
    const en = verificationApiCopy("en");
    const ru = verificationApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.unauthorized).toBe("Unauthorized");
    expect(ru.unauthorized).toBe("Нет доступа");
    expect(en.serverChallengeRequired).toContain("MTA control challenge");
    expect(ru.alreadyPending).toContain("ожидает");
    expect(en.submitFailed).toContain("Failed to submit");
    expect(ru.retry).toContain("Повторите");

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/verification/route.ts"),
      "utf8",
    );
    expect(route).toContain("verificationApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.unauthorized");
    expect(route).toContain("copy.loadFailed");
    expect(route).toContain("copy.authenticationRequired");
    expect(route).toContain("copy.rate");
    expect(route).toContain("copy.invalidRequest");
    expect(route).toContain("copy.serverChallengeRequired");
    expect(route).toContain("copy.ownProfileOnly");
    expect(route).toContain("copy.organizationNotFound");
    expect(route).toContain("copy.organizationNotManaged");
    expect(route).toContain("copy.alreadyVerified");
    expect(route).toContain("copy.alreadyPending");
    expect(route).toContain("copy.retry");
    expect(route).toContain("copy.submitFailed");
    expect(route).toContain("localeAppErrorText");
    expect(route).not.toContain("error.message");
    expect(route).not.toContain('"Unauthorized"');
    expect(route).not.toContain('"Failed to load verification requests"');
    expect(route).not.toContain('"Authentication required"');
    expect(route).not.toContain('"Too many verification requests. Please try again tomorrow."');
    expect(route).not.toContain('"Invalid verification request"');
    expect(route).not.toContain(
      '"Server ownership verification requires the MTA control challenge flow."',
    );
    expect(route).not.toContain('"You can only verify your own profile"');
    expect(route).not.toContain('"Organization was not found"');
    expect(route).not.toContain('"You do not manage this organization"');
    expect(route).not.toContain('"This target is already verified"');
    expect(route).not.toContain('"A verification request is already pending"');
    expect(route).not.toContain('"Please retry the application"');
    expect(route).not.toContain('"Failed to submit verification request"');
  });
});
