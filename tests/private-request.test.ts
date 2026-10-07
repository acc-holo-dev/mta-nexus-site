import { describe, expect, it } from "vitest";
import { privateRequest } from "../apps/web/src/lib/private-request";

describe("private request policy", () => {
  it("enforces same-origin credentials and no-store", () => {
    expect(
      privateRequest({
        method: "PATCH",
        cache: "force-cache",
        credentials: "omit",
        headers: { "X-Test": "1" },
      }),
    ).toMatchObject({
      method: "PATCH",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "X-Test": "1" },
    });
  });
});
