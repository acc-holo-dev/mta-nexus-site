import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("hub library description and reverse-dependents wallet honesty", () => {
  it("wires hub library description and gates reverse-dependents empty copy on the wallet engine", () => {
    const hub = read("site/src/features/shell/server/workspace-hub-page.tsx");
    const reverse = read("site/src/features/resources/components/reverse-dependency-list.tsx");
    const detail = read("site/src/features/resources/server/detail-page.tsx");

    expect(hub).toContain("walletLibraryDescription");
    expect(hub).toContain("libraryDescription");
    expect(reverse).toContain("noDependentsWallet");
    expect(reverse).toContain("walletEnabled");
    expect(detail).toContain("walletEnabled={walletEnabled}");
  });

  it("keeps free-only hub/dependents dialect by default and admits paid when wallet keys are used", () => {
    const en = getDictionary("en");
    const ru = getDictionary("ru");

    expect(en.workspace.libraryDescription).toMatch(/free/i);
    expect(en.workspace.walletLibraryDescription).toMatch(/site-wallet/i);
    expect(en.workspace.walletLibraryDescription).toMatch(/payment ledger/i);
    expect(en.dependencyUi.noDependents).toMatch(/free/i);
    expect(en.dependencyUi.noDependentsWallet).not.toMatch(/free/i);
    expect(en.dependencyUi.noDependentsWallet).toMatch(/wallet engine/i);

    expect(ru.workspace.walletLibraryDescription).toMatch(/site wallet/i);
    expect(ru.dependencyUi.noDependents).toMatch(/бесплатн/i);
    expect(ru.dependencyUi.noDependentsWallet).not.toMatch(/бесплатн/i);
    expect(ru.dependencyUi.noDependentsWallet).toMatch(/wallet engine/i);
  });
});
