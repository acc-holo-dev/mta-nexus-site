import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("wallet workspace org held empty-state honesty", () => {
  it("uses EmptyState for org held empty and keeps unavailable separate", () => {
    const copy = getWalletCopy("en");
    expect(copy.heldOrgEmptyHint).toContain("not a load failure");
    expect(copy.heldOrgEmptyHint).toContain("escrow");

    const screen = read("site/src/features/commerce/server/wallet-workspace-screen.tsx");
    expect(screen).toContain("heldOrgEmptyHint");
    expect(screen).toContain(
      "<EmptyState title={copy.heldOrgEmpty} description={copy.heldOrgEmptyHint} />",
    );
    expect(screen).toContain("heldUnavailable");
    const unavailableIdx = screen.indexOf("org.held === null || org.holds === null");
    const emptyIdx = screen.indexOf("heldOrgEmptyHint");
    expect(unavailableIdx).toBeGreaterThan(-1);
    expect(emptyIdx).toBeGreaterThan(unavailableIdx);
  });
});
