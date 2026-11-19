import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { adminActionClientError } from "../../src/features/moderation/admin-action-client-error";
import { adminActionsApiCopy } from "../../src/features/moderation/admin-actions-api-copy";

it("maps admin action codes to ApiCopy without English body passthrough", () => {
  for (const locale of ["en", "ru"] as const) {
    const copy = adminActionsApiCopy(locale);
    expect(adminActionClientError(locale, "FORBIDDEN", "fallback")).toBe(copy.forbidden);
    expect(adminActionClientError(locale, "ACTOR_ID_REQUIRED", "fallback")).toBe(
      copy.authenticationRequired,
    );
    expect(adminActionClientError(locale, "CONFLICT", "fallback")).toBe(copy.conflict);
    expect(adminActionClientError(locale, "VALIDATION_ERROR", "fallback")).toBe(copy.invalidAction);
    expect(adminActionClientError(locale, "UNKNOWN", "fallback")).toBe("fallback");
  }
  expect(adminActionClientError("en", "FORBIDDEN", "x")).not.toEqual(
    adminActionClientError("ru", "FORBIDDEN", "x"),
  );
});

it("stops admin/auth/acquire clients from assigning data?.error English bodies", () => {
  for (const relative of [
    "site/src/features/moderation/components/report-moderation-controls.tsx",
    "site/src/features/resources/components/build-quarantine-controls.tsx",
    "site/src/features/resources/components/admin-resource-qa-report-actions.tsx",
    "site/src/app/auth/forgot-password/page.tsx",
    "site/src/app/auth/reset-password/page.tsx",
    "site/src/app/auth/verify-email/page.tsx",
    "site/src/app/acquire/page.tsx",
    "site/src/features/resources/components/new-resource-form.tsx",
  ]) {
    const source = readFileSync(resolve(process.cwd(), relative), "utf8");
    expect(source).not.toMatch(/data\?\.error\s*\|\|/u);
    expect(source).not.toMatch(/decidePayload\?\.error\s*\|\|/u);
    expect(source).not.toMatch(/productData\?\.error/u);
    expect(source).not.toMatch(/buildData\?\.error/u);
  }

  const settings = readFileSync(
    resolve(process.cwd(), "site/src/features/accounts/settings-client-api.ts"),
    "utf8",
  );
  expect(settings).not.toContain("Account settings are temporarily unavailable.");
  expect(settings).not.toContain("The server returned an unreadable response.");
  expect(settings).toContain("requires locale unavailable/unreadable messages");

  const authForm = readFileSync(
    resolve(process.cwd(), "site/src/features/accounts/components/auth-form.tsx"),
    "utf8",
  );
  expect(authForm).not.toMatch(/data\.error\s*\?\?/u);
  expect(authForm).not.toContain('typeof data.error === "string"');
  expect(authForm).toContain("authLoginApiCopy");
  expect(authForm).toContain("authRegisterApiCopy");

  const mutation = readFileSync(
    resolve(process.cwd(), "site/src/features/servers/server-mutation-errors.ts"),
    "utf8",
  );
  expect(mutation).not.toContain("payload.error");

  const comment = readFileSync(
    resolve(process.cwd(), "site/src/features/community/content-comment-client.ts"),
    "utf8",
  );
  expect(comment).not.toContain('typeof (payload as Record<string, unknown>).error === "string"');
});
