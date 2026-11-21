import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("acquire guest auth return (FLOW-01)", () => {
  it("preserves productId through login/register and never auto-claims after auth alone", () => {
    const source = read("site/src/features/commerce/components/acquire-page.tsx");

    expect(source).toContain('authEntryHref("login", acquireReturnPath)');
    expect(source).toContain('authEntryHref("register", acquireReturnPath)');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: assert acquire page source contains this template literal.
    expect(source).toContain("`/acquire?productId=${encodeURIComponent(productId)}${");
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

  it("locks ErrorState load failures, EmptyState empties, touch CTAs, and clipped shells", () => {
    const page = read("site/src/features/commerce/components/acquire-page.tsx");
    const loading = read("site/src/app/acquire/loading.tsx");

    expect(page).toContain("ErrorState");
    expect(page).toContain("EmptyState");
    expect(page).toContain("dictionary.errors.retry");
    expect(page).toContain('size="touch"');
    expect(page).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
    expect(page).toMatch(/(?:min-w-0|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
    expect(page).toMatch(/(?:min-h-11|link[A-Za-z]\w*|link-shell)/);
    expect(page).not.toContain('role="alert"');
    expect(loading).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
    expect(loading).toMatch(/(?:min-w-0|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
  });

  it("keeps productNotFound EmptyState distinct from loadFailed ErrorState", () => {
    const page = read("site/src/features/commerce/components/acquire-page.tsx");
    expect(page).toContain("copy.productNotFound");
    expect(page).toContain("copy.loadFailed");
    expect(page).toMatch(
      /const notFound = productError === copy\.productNotFound;[\s\S]*?notFound \? \([\s\S]*?<EmptyState[\s\S]*?\) : \([\s\S]*?<ErrorState/u,
    );
    expect(page).toContain("setLoadRevision");
  });

  it("routes paid acquire through wallet checkout when the engine flag is on", () => {
    const page = read("site/src/features/commerce/components/acquire-page.tsx");
    const screen = read("site/src/features/commerce/server/acquire-page-screen.tsx");
    const route = read("site/src/app/acquire/page.tsx");
    expect(page).toContain("WalletCheckoutButton");
    expect(page).toContain('data-acquire-intent="wallet"');
    expect(page).toContain("walletEnabled && product.price > 0");
    expect(page).toContain("copy.paidDisabled");
    expect(screen).toContain("isWalletEngineEnabled");
    expect(screen).toContain("authService.getSession");
    expect(route).toContain("acquire-page-server");
    expect(route).not.toContain("use client");
  });

  it("preserves optional buildId through acquire return and wallet checkout", () => {
    const page = read("site/src/features/commerce/components/acquire-page.tsx");
    const checkout = read("site/src/features/commerce/components/wallet-checkout-button.tsx");
    const detail = read("site/src/features/resources/server/detail-page.tsx");
    expect(page).toContain('searchParams.get("buildId")');
    expect(page).toContain("buildId={buildId ?? undefined}");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: assert acquire return preserves buildId query.
    expect(page).toContain("`&buildId=${encodeURIComponent(buildId)}`");
    expect(checkout).toContain("...(buildId ? { buildId } : {})");
    expect(detail).toMatch(
      /buildId=\{\s*versionHelpBuild\?\.status === "published" \? versionHelpBuild\.id : undefined\s*\}/u,
    );
  });
});
