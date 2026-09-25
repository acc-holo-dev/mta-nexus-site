import { describe, expect, it } from "vitest";
import { decideResourceDownloadAccess } from "../apps/web/src/lib/resource-download-policy";

describe("resource download authorization matrix", () => {
  const published = {
    status: "published" as const,
  };

  it("allows current resource managers and entitled users", () => {
    expect(
      decideResourceDownloadAccess(published, true, false),
    ).toEqual({ allowed: true, reason: "manager" });

    expect(
      decideResourceDownloadAccess(published, false, true),
    ).toEqual({ allowed: true, reason: "entitlement" });
  });

  it("denies a non-manager without entitlement", () => {
    expect(
      decideResourceDownloadAccess(published, false, false),
    ).toEqual({ allowed: false, reason: "entitlement_required" });
  });

  it("fails closed for unpublished resources regardless of management or entitlement", () => {
    for (const input of [
      { manager: true, entitlement: false },
      { manager: false, entitlement: true },
      { manager: true, entitlement: true },
    ]) {
      expect(
        decideResourceDownloadAccess(
          { status: "draft" },
          input.manager,
          input.entitlement,
        ),
      ).toEqual({
        allowed: false,
        reason: "resource_not_published",
      });
    }
  });
});
