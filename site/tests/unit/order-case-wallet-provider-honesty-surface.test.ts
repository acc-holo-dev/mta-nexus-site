import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("order-case wallet provider honesty", () => {
  it("shows normalized payment provider on evidence without hashing it", () => {
    const domain = read("site/packages/domain/src/order-cases.ts");
    const repo = read("site/packages/db/src/repositories/order-cases.ts");
    const page = read("site/src/features/commerce/server/order-case-page.tsx");
    const i18n = read("site/src/features/commerce/order-case-i18n.ts");

    expect(domain).toContain("provider?: string | null");
    expect(domain).toContain("not part of evidenceIdentity");
    expect(repo).toContain("provider: payments.provider");
    expect(repo).toContain("provider: row.provider");
    expect(repo).toMatch(
      /value\.payments\.map\(\(p\) => \[\s*p\.recordKey,\s*p\.status,\s*p\.amount,\s*p\.currency,\s*p\.createdAt,\s*p\.updatedAt,\s*\]\)/u,
    );
    expect(repo).not.toMatch(/evidenceIdentity[\s\S]*p\.provider/u);
    expect(page).toContain("commercialProviderLabel(locale, payment.provider)");
    expect(page).toContain("copy.provider");
    expect(i18n).toContain("completed site-wallet row is an audited ledger settle");
    expect(i18n).toContain("provider:");
  });
});
