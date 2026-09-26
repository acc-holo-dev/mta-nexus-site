import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("shared client localization and request hardening", () => {
  it("localizes workspace context switching and hardens both requests", () => {
    const source = read("apps/web/src/components/context-switcher.tsx");

    expect(source).toContain("useNexusLocale");
    expect(source).toContain("dictionary.workspaceContext");
    expect(source.match(/credentials: "same-origin"/g)?.length).toBe(2);
    expect(source.match(/cache: "no-store"/g)?.length).toBe(2);
    expect(source.match(/AbortSignal.timeout\(10_000\)/g)?.length).toBe(2);

    const en = getDictionary("en").workspaceContext;
    const ru = getDictionary("ru").workspaceContext;
    expect(en.title).not.toBe(ru.title);
    expect(en.switchError).not.toBe(ru.switchError);
  });

  it("keeps MTA directory errors in the dictionary and requests uncached data", () => {
    const source = read(
      "apps/web/src/components/mta-master-server-directory.tsx",
    );

    expect(source).toContain("copy.directoryTimeout");
    expect(source).toContain("copy.directoryFetchError");
    expect(source).toContain("copy.publicServersLabel");
    expect(source).toContain('cache: "no-store"');
    expect(source).toContain('credentials: "same-origin"');
    expect(source).not.toContain(
      "Каталог MTA слишком долго не отвечал",
    );

    const en = getDictionary("en").servers;
    const ru = getDictionary("ru").servers;
    expect(en.directoryTimeout).not.toBe(ru.directoryTimeout);
    expect(en.publicServersLabel).not.toBe(ru.publicServersLabel);
  });

  it("uses the hardened request contract for login and registration", () => {
    const source = read("apps/web/src/components/auth-form.tsx");

    expect(source).toContain('cache: "no-store"');
    expect(source).toContain('credentials: "same-origin"');
    expect(source).toContain("AbortSignal.timeout(15_000)");
    expect(source).toContain("bg-danger-soft");
  });
});
