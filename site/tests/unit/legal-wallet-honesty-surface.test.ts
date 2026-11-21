import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("legal wallet honesty", () => {
  it("gates Terms body on the wallet engine without inventing live PSP or payouts", () => {
    const page = read("site/src/features/shell/server/legal-document-page.tsx");
    expect(page).toContain("isWalletEngineEnabled");
    expect(page).toContain("walletLead");
    expect(page).toContain("walletSections");
    expect(page).toContain("walletUpdated");

    const en = getDictionary("en").legal.terms;
    const ru = getDictionary("ru").legal.terms;
    expect(en.sections[0]?.body).toContain("out of scope");
    expect(en.walletSections[0]?.body).toContain("site-wallet");
    expect(en.walletSections[0]?.body).toContain("Card checkout");
    expect(en.walletSections[0]?.body).toContain("live payouts");
    expect(en.walletSections.some((section) => section.title === "Site wallet stored value")).toBe(
      true,
    );
    expect(en.walletLead).toContain("site-wallet engine");
    expect(en.walletUpdated).toBe("21 November 2026");
    expect(ru.walletSections[0]?.body).toContain("site wallet");
    expect(ru.walletSections[0]?.body).toContain("Карточный checkout");
    expect(ru.walletLead).toContain("site wallet");
    expect(ru.walletUpdated).toBe("21 ноября 2026");
  });

  it("gates Privacy body on the wallet engine and discloses ledger data without inventing a bank or live PSP", () => {
    const page = read("site/src/features/shell/server/legal-document-page.tsx");
    expect(page).toContain("legal.privacy.walletLead");
    expect(page).toContain("legal.privacy.walletSections");

    const en = getDictionary("en").legal.privacy;
    const ru = getDictionary("ru").legal.privacy;
    expect(en.sections.some((section) => section.title === "Site wallet ledger data")).toBe(false);
    expect(en.walletSections.some((section) => section.title === "Site wallet ledger data")).toBe(
      true,
    );
    const ledger = en.walletSections.find((section) => section.title === "Site wallet ledger data");
    expect(ledger?.body).toContain("audited ledger");
    expect(ledger?.body).toContain("not a bank account");
    expect(ledger?.body).toContain("Card checkout");
    expect(ledger?.body).not.toContain("live Stripe");
    expect(en.walletLead).toContain("site-wallet engine");
    expect(en.walletUpdated).toBe("21 November 2026");
    expect(ru.walletSections.some((section) => section.title === "Данные ledger site wallet")).toBe(
      true,
    );
    expect(ru.walletLead).toContain("site wallet");
    expect(ru.walletUpdated).toBe("21 ноября 2026");
  });
});
