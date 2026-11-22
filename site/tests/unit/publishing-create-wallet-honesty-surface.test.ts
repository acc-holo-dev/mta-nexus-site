import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("publishing create wallet honesty", () => {
  it("gates create title, description, and submit on wallet paid publishing", () => {
    const form = read("site/src/features/resources/components/new-resource-form.tsx");
    const screen = read("site/src/features/resources/server/resource-create-screen.tsx");

    expect(form).toContain("walletPaidPublishing");
    expect(form).toContain("walletResourceTitle");
    expect(form).toContain("walletResourceDescription");
    expect(form).toContain("walletSubmit");
    expect(screen).toContain("walletResourceTitle");
    expect(screen).toContain("isWalletEngineEnabled");
  });

  it("keeps free-only create chrome by default and admits paid when wallet keys are used", () => {
    const en = getDictionary("en").publishing;
    const ru = getDictionary("ru").publishing;

    expect(en.resourceTitle).toMatch(/free/i);
    expect(en.walletResourceTitle).not.toMatch(/free/i);
    expect(en.resourceDescription).toMatch(/Paid publishing remains disabled/i);
    expect(en.walletResourceDescription).toMatch(/site wallet/i);
    expect(en.walletResourceDescription).not.toMatch(/Paid publishing remains disabled/i);
    expect(en.submit).toMatch(/free/i);
    expect(en.walletSubmit).not.toMatch(/free/i);

    expect(ru.resourceTitle).toMatch(/бесплатн/i);
    expect(ru.walletResourceTitle).not.toMatch(/бесплатн/i);
    expect(ru.resourceDescription).toMatch(/Платная публикация пока отключена/i);
    expect(ru.walletResourceDescription).toMatch(/site wallet/i);
    expect(ru.walletResourceDescription).not.toMatch(/Платная публикация пока отключена/i);
  });
});
