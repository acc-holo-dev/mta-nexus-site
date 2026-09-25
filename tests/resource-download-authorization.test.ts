import { describe, expect, it } from "vitest";
import { decideResourceDownloadAccess } from "../apps/web/src/lib/resource-download-policy";

describe("resource download authorization matrix", () => {
  const published = {
    authorId: "usr_author",
    status: "published" as const,
  };

  it("allows author, admin and entitled users for published resources", () => {
    expect(
      decideResourceDownloadAccess(
        { id: "usr_author", role: "developer" },
        published,
        false,
      ),
    ).toEqual({ allowed: true, reason: "author" });

    expect(
      decideResourceDownloadAccess(
        { id: "usr_admin", role: "admin" },
        published,
        false,
      ),
    ).toEqual({ allowed: true, reason: "admin" });

    expect(
      decideResourceDownloadAccess(
        { id: "usr_player", role: "user" },
        published,
        true,
      ),
    ).toEqual({ allowed: true, reason: "entitlement" });
  });

  it("denies an unentitled other user", () => {
    expect(
      decideResourceDownloadAccess(
        { id: "usr_player", role: "user" },
        published,
        false,
      ),
    ).toEqual({ allowed: false, reason: "entitlement_required" });
  });

  it("fails closed for unpublished resources even for author/admin/entitled users", () => {
    for (const input of [
      { user: { id: "usr_author", role: "developer" as const }, entitlement: false },
      { user: { id: "usr_admin", role: "admin" as const }, entitlement: false },
      { user: { id: "usr_player", role: "user" as const }, entitlement: true },
    ]) {
      expect(
        decideResourceDownloadAccess(
          input.user,
          { authorId: "usr_author", status: "draft" },
          input.entitlement,
        ),
      ).toEqual({
        allowed: false,
        reason: "resource_not_published",
      });
    }
  });
});
