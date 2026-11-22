import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("publication feed and follow workspace wallet honesty", () => {
  it("gates product feed attribution and follow targets on the wallet engine", () => {
    const feed = read("site/packages/db/src/repositories/publication-feed.ts");
    const follows = read("site/packages/db/src/repositories/follow-workspace.ts");
    const feedService = read("site/src/lib/services/discovery/publication-feed-service.ts");
    const followService = read("site/src/lib/services/community/follow-workspace-service.ts");

    expect(feed).toContain("includeWalletPaidSingleServer");
    expect(feed).toContain("publishedCatalogPriceCondition");
    expect(follows).toContain("publicFollowProduct");
    expect(follows).toContain("includeWalletPaidSingleServer");
    expect(follows).toContain("publishedCatalogPriceCondition");
    expect(feedService).toContain("includeWalletPaidSingleServer: isWalletEngineEnabled()");
    expect(followService).toContain("includeWalletPaidSingleServer: isWalletEngineEnabled()");
  });
});
