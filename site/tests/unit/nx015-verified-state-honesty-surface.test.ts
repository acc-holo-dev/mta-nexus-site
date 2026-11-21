import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("NX-015 verified-state honesty", () => {
  it("keeps system/constraints/roadmap aligned with dark-flag site wallet truth", () => {
    const system = read("docs/current/system.md");
    const constraints = read("docs/issues/constraints.md");
    const roadmap = read("docs/ROADMAP.md");
    const commerce = read("docs/future/commerce.md");

    expect(system).not.toContain("платежи в free beta не включены");
    expect(system).toContain("NEXUS_WALLET_ENGINE=1");
    expect(system).toContain("NEXUS_WALLET_WITHDRAW=1");
    expect(system).toContain("OPERATIONS.md#site-wallet-dark-flags");
    expect(system).toContain("NX-015");
    expect(system).toContain("live money movement");
    expect(system).toContain("не** есть production deploy");

    expect(constraints).toContain("## Site wallet (NX-015) — operational constraint");
    expect(constraints).toContain("NEXUS_WALLET_ENGINE");
    expect(constraints).toContain("NEXUS_WALLET_WITHDRAW");
    expect(constraints).toContain("CHECKOUT_DISABLED");
    expect(constraints).toContain("не означает live payments");

    expect(roadmap).toContain("NX-015");
    expect(roadmap).toContain("OPERATIONS.md#site-wallet-dark-flags");
    expect(roadmap).toContain("не включает live PSP/payout/refund");

    expect(commerce).toContain("Implementation status:");
    expect(commerce).toContain("NEXUS_WALLET_ENGINE");
    expect(commerce).toContain("OPERATIONS.md#site-wallet-dark-flags");
  });
});
