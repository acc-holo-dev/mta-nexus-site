import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthForm } from "../../src/features/accounts/auth";
import { getDictionary } from "../../src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("auth register wallet honesty", () => {
  it("passes the wallet engine flag from the register screen into AuthForm", () => {
    const screen = read("site/src/features/accounts/server/register-screen.tsx");
    const form = read("site/src/features/accounts/components/auth-form.tsx");
    expect(screen).toContain("isWalletEngineEnabled");
    expect(screen).toContain("walletEnabled={isWalletEngineEnabled()}");
    expect(form).toContain("walletEnabled");
    expect(form).toContain("registerWalletDescription");
  });

  it("keeps free-only register copy by default and admits paid library when walletEnabled", () => {
    const en = getDictionary("en").auth;
    const ru = getDictionary("ru").auth;
    expect(en.registerDescription).toContain("free resources");
    expect(en.registerWalletDescription).toContain("Site-wallet");
    expect(en.registerWalletDescription).toContain("card checkout stays off");
    expect(en.registerWalletDescription).not.toBe(en.registerDescription);
    expect(ru.registerWalletDescription).toContain("site wallet");

    const freeHtml = renderToStaticMarkup(
      createElement(AuthForm, { mode: "register", locale: "en" }),
    );
    expect(freeHtml).toContain(en.registerDescription);
    expect(freeHtml).not.toContain(en.registerWalletDescription);

    const walletHtml = renderToStaticMarkup(
      createElement(AuthForm, { mode: "register", locale: "en", walletEnabled: true }),
    );
    expect(walletHtml).toContain(en.registerWalletDescription);
    expect(walletHtml).not.toContain(en.registerDescription);
  });
});
