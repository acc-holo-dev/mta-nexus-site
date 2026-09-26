import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("account recovery UI", () => {
  it("keeps password-reset request responses account-neutral and time-floored", () => {
    const route = read(
      "apps/web/src/app/api/auth/password-reset/route.ts",
    );

    expect(route).toContain("const neutral = {");
    expect(route).toContain(
      "If an eligible account uses that email, a password reset link will be sent.",
    );
    expect(route).toContain("requestFloorMinMs");
    expect(route).toContain("requestFloorJitterMs");
    expect(route).toContain("await floor(startedAt, targetMs)");
  });

  it("keeps reset and verification proofs out of browser history", () => {
    const reset = read(
      "apps/web/src/app/auth/reset-password/page.tsx",
    );
    const verify = read(
      "apps/web/src/app/auth/verify-email/page.tsx",
    );

    for (const page of [reset, verify]) {
      expect(page).toContain('url.hash.startsWith("#")');
      expect(page).toContain(
        'window.history.replaceState(null, "", url.pathname)',
      );
      expect(page).toContain('credentials: "same-origin"');
      expect(page).toContain('cache: "no-store"');
      expect(page).toContain("AbortSignal.timeout(15_000)");
    }
  });

  it("hardens forgot-password requests without changing neutral UX", () => {
    const page = read(
      "apps/web/src/app/auth/forgot-password/page.tsx",
    );

    expect(page).toContain('credentials: "same-origin"');
    expect(page).toContain('cache: "no-store"');
    expect(page).toContain("AbortSignal.timeout(15_000)");
    expect(page).toContain("dictionary.recovery");
  });

  it("provides RU and EN copy for the complete recovery journey", () => {
    const en = getDictionary("en").recovery;
    const ru = getDictionary("ru").recovery;

    expect(en.forgotTitle).not.toBe(ru.forgotTitle);
    expect(en.resetTitle).not.toBe(ru.resetTitle);
    expect(en.verifyTitle).not.toBe(ru.verifyTitle);
    expect(en.resetSuccess).not.toBe(ru.resetSuccess);
  });
});
