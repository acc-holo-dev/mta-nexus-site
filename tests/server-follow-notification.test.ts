import { describe, expect, it } from "vitest";
import { buildServerPublicationNotification } from "../apps/web/src/lib/server-follow-notifications";

describe("server publication notification", () => {
  it("links a server follower to the published content without claiming live alerts", () => {
    const notification = buildServerPublicationNotification(
      { name: "Nexus Racing" },
      { title: "Season 4 changelog", slug: "season-4-changelog" },
    );

    expect(notification).toEqual({
      title: "New server update",
      message: "Nexus Racing: Season 4 changelog",
      link: "/articles/season-4-changelog",
      type: "server",
      category: "server",
    });
    expect(JSON.stringify(notification)).not.toMatch(
      /online|offline|uptime|player threshold/iu,
    );
  });
});
