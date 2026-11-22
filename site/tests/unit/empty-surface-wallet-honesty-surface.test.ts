import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("empty surface wallet honesty", () => {
  it("gates workspace hub, developer, and organization empty hints on the wallet engine", () => {
    const hub = read("site/src/features/shell/server/workspace-hub-page.tsx");
    const developer = read("site/src/features/accounts/server/developer-profile-screen.tsx");
    const organization = read("site/src/features/organizations/server/public-profile.tsx");

    expect(hub).toContain("emptyLibraryHintWallet");
    expect(hub).toContain("walletEnabled");
    expect(developer).toContain("noReleasesHintWallet");
    expect(organization).toContain("emptyPortfolioHintWallet");
  });

  it("keeps free-only empty hints by default and admits paid when wallet keys are used", () => {
    const en = getDictionary("en");
    const ru = getDictionary("ru");

    expect(en.workspace.emptyLibraryHint).toMatch(/Free resources/i);
    expect(en.workspace.emptyLibraryHintWallet).toMatch(/paid/i);
    expect(en.workspace.emptyLibraryHintWallet).toMatch(/site-wallet/i);
    expect(en.developers.noReleasesHint).toMatch(/free/i);
    expect(en.developers.noReleasesHintWallet).toMatch(/paid/i);
    expect(en.developers.noReleasesHintWallet).not.toMatch(/^Published free resources by/i);
    expect(en.organizations.emptyPortfolioHint).toMatch(/free/i);
    expect(en.organizations.emptyPortfolioHintWallet).toMatch(/paid/i);

    expect(ru.workspace.emptyLibraryHintWallet).toMatch(/платн/i);
    expect(ru.developers.noReleasesHintWallet).toMatch(/платн/i);
    expect(ru.organizations.emptyPortfolioHintWallet).toMatch(/платн/i);
  });
});
