import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/** Wave 105: account mail subjects/bodies stay bilingual without a recipient locale column. */
describe("account mail dispatcher copy honesty surface", () => {
  it("keeps bilingual slash subjects and bodies in the dispatcher", () => {
    const source = readFileSync(
      resolve(process.cwd(), "site/packages/db/src/repositories/account-mail-dispatcher.ts"),
      "utf8",
    );
    expect(source).toContain("Confirm your MTA NEXUS email / Подтвердите email MTA NEXUS");
    expect(source).toContain("Reset your MTA NEXUS password / Сбросьте пароль MTA NEXUS");
    expect(source).toContain("Подтвердите этот email для аккаунта MTA NEXUS");
    expect(source).toContain("Используйте ссылку, чтобы сбросить пароль MTA NEXUS");
    expect(source).toContain("challenge");
    expect(source).toContain("token=");
  });
});
