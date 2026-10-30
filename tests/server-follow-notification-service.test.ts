import { describe, expect, it } from "vitest";
import { buildServerPublicationNotification } from "../apps/web/src/lib/server-follow-notifications";

describe("server publication notification copy", () => {
  it("builds generic follower-facing publication copy", () => {
    expect(
      buildServerPublicationNotification(
        { name: "Nexus Racing" },
        { title: "Season update", slug: "season-update" },
      ),
    ).toEqual({
      title: "New server update",
      message: "Nexus Racing: Season update",
      link: "/articles/season-update",
      type: "server",
      category: "server",
    });
  });
});
