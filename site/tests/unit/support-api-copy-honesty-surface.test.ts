import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  supportWorkspaceCopy,
  supportWorkspaceError,
} from "../../src/features/support/support-workspace-copy";

/** Wave 102: /api/support envelopes always localize via supportPrivateJson + supportWorkspaceError. */
describe("support API copy honesty surface", () => {
  it("keeps RU/EN workspace error keys and remaps both locales by code", () => {
    const en = supportWorkspaceCopy("en");
    const ru = supportWorkspaceCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(supportWorkspaceError("en", "UNAUTHORIZED")).toBe(en.auth);
    expect(supportWorkspaceError("ru", "UNAUTHORIZED")).toBe(ru.auth);
    expect(supportWorkspaceError("en", "ACTOR_CHANGED")).toBe(en.conflict);
    expect(supportWorkspaceError("ru", "ACTOR_ID_REQUIRED")).toBe(ru.invalid);
    expect(en.auth).not.toEqual(ru.auth);
  });

  it("wires supportPrivateJson to always overwrite error for both locales", () => {
    const http = readFileSync(
      resolve(process.cwd(), "site/src/features/support/support-http.ts"),
      "utf8",
    );
    expect(http).toContain("supportWorkspaceError");
    expect(http).toContain("nexus_locale");
    expect(http).not.toContain('locale === "ru"');

    for (const relative of [
      "site/src/app/api/support/route.ts",
      "site/src/app/api/support/[id]/route.ts",
    ]) {
      const route = readFileSync(resolve(process.cwd(), relative), "utf8");
      expect(route).toContain("supportPrivateJson");
      expect(route).not.toMatch(/error:\s*"[A-Za-z]/);
    }
  });
});
