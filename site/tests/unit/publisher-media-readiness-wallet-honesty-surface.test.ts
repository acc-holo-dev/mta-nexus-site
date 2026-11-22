import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("publisher media and publication readiness wallet honesty", () => {
  it("gates media manage/public/authorize and readiness free-only filters on the wallet engine", () => {
    const mediaService = read("site/src/lib/services/resources/resource-media-service.ts");
    const mediaRepo = read("site/packages/db/src/repositories/resource-media.ts");
    const readinessService = read(
      "site/src/lib/services/resources/resource-publication-readiness-service.ts",
    );
    const readinessRepo = read(
      "site/packages/db/src/repositories/resource-publication-readiness.ts",
    );
    const detail = read("site/src/features/resources/server/detail-page.tsx");
    const imageHttp = read("site/src/features/resources/resource-media-image-http.ts");

    expect(mediaService).toContain("isWalletEngineEnabled");
    expect(mediaService).toContain("allowPaid: isWalletEngineEnabled()");
    expect(mediaRepo).toContain("PaidAccessOptions");
    expect(mediaRepo).toContain("options.allowPaid");
    expect(mediaRepo).toContain("eq(products.price, 0)");

    expect(readinessService).toContain("allowPaid: isWalletEngineEnabled()");
    expect(readinessRepo).toContain("allowPaid ? undefined : eq(products.price, 0)");

    expect(detail).toContain("allowPaid: walletEnabled");
    expect(imageHttp).toContain("allowPaid: isWalletEngineEnabled()");
  });
});
