import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthForm } from "../apps/web/src/components/auth-form";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("beta auth UI surface (ROADMAP 18)", () => {
  it("keeps RU/EN auth and recovery copy distinct", () => {
    const enAuth = getDictionary("en").auth;
    const ruAuth = getDictionary("ru").auth;
    const enRecovery = getDictionary("en").recovery;
    const ruRecovery = getDictionary("ru").recovery;

    for (const key of [
      "loginTitle",
      "registerTitle",
      "email",
      "password",
      "signIn",
      "create",
      "signingIn",
      "genericError",
      "loginError",
      "registerError",
    ] as const) {
      expect(enAuth[key]).not.toBe(ruAuth[key]);
      expect(enAuth[key].trim().length).toBeGreaterThan(0);
      expect(ruAuth[key].trim().length).toBeGreaterThan(0);
    }

    for (const key of [
      "forgotTitle",
      "sendReset",
      "accepted",
      "resetTitle",
      "newPassword",
      "confirmPassword",
      "resetSuccess",
      "checkingReset",
    ] as const) {
      expect(enRecovery[key]).not.toBe(ruRecovery[key]);
    }
  });

  it("wires labeled fields, alerts, and loading affordances on login and register", () => {
    for (const locale of ["en", "ru"] as const) {
      const copy = getDictionary(locale).auth;
      for (const mode of ["login", "register"] as const) {
        const html = renderToStaticMarkup(<AuthForm mode={mode} locale={locale} />);
        expect(html).toContain(`>${copy.email}<`);
        expect(html).toContain(`>${copy.password}<`);
        expect(html).toContain('for="auth-email"');
        expect(html).toContain('id="auth-email"');
        expect(html).toContain('for="auth-password"');
        expect(html).toContain('id="auth-password"');
        expect(html).toContain('type="submit"');
        expect(html).toContain("min-h-11");
        expect(html).toContain("px-4");
        expect(html).toMatch(/focus-visible:ring-2|focus-visible:outline/u);
        if (mode === "register") {
          expect(html).toContain(`>${copy.username}<`);
          expect(html).toContain('for="auth-username"');
          expect(html).toContain('id="username-hint"');
          expect(html).toContain('aria-describedby="username-hint"');
        } else {
          expect(html).toContain(copy.forgot);
          expect(html).toContain('href="/auth/forgot-password"');
        }
      }
    }
  });

  it("uses shared @nexus/ui Input/Button on auth and recovery screens", () => {
    const auth = read("apps/web/src/components/auth-form.tsx");
    const forgot = read("apps/web/src/app/auth/forgot-password/page.tsx");
    const reset = read("apps/web/src/app/auth/reset-password/page.tsx");

    for (const source of [auth, forgot, reset]) {
      expect(source).toContain('from "@nexus/ui"');
      expect(source).toContain("Button");
      expect(source).toContain("Input");
      expect(source).toContain("isLoading");
      expect(source).toContain("min-h-11");
    }

    expect(auth).toContain('role="alert"');
    expect(auth).toContain("aria-busy={loading}");
    expect(auth).toContain("bg-danger-soft");
    expect(forgot).toContain('role={notice.error ? "alert" : "status"}');
    expect(reset).toContain('role="status"');
    expect(reset).toContain('role="alert"');
    expect(reset).toContain("copy.checkingReset");
    expect(reset).toContain("copy.resetSuccess");
  });
});
