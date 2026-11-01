import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("acquire guest auth return (FLOW-01)", () => {
  it("preserves productId through login/register and never auto-claims after auth alone", () => {
    const source = read("apps/web/src/app/acquire/page.tsx");

    expect(source).toContain('authEntryHref("login", acquireReturnPath)');
    expect(source).toContain('authEntryHref("register", acquireReturnPath)');
    expect(source).toContain("`/acquire?productId=${encodeURIComponent(productId)}`");
    expect(source).toContain("response.status === 401");
    expect(source).toContain('href="/workspace/library"');
    expect(source).not.toMatch(/href=["']\/workspace["']/u);
    // Claim remains an explicit button action; mount/effect must not POST claim.
    expect(source).toContain("onClick={() => void handleClaim()}");
    // Claim fetch must stay inside handleClaim, not a mount effect body.
    const claimIndex = source.indexOf('fetch("/api/resources/claim"');
    const handleClaimIndex = source.indexOf("async function handleClaim");
    expect(handleClaimIndex).toBeGreaterThan(-1);
    expect(claimIndex).toBeGreaterThan(handleClaimIndex);
  });
});
