import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server follower publication notifications", () => {
  it("fans out only after moderator-approved server-linked publication", () => {
    const service = read(
      "apps/web/src/lib/services/content-service.ts",
    );
    const adminRoute = read(
      "apps/web/src/app/api/admin/actions/route.ts",
    );
    const createRoute = read(
      "apps/web/src/app/api/content/route.ts",
    );

    expect(service).toContain("CONTENT_ALREADY_IN_STATE");
    expect(service).not.toContain(
      "notifyServerFollowersOfPublishedContent",
    );
    expect(adminRoute).toContain(
      'if (action === "publish" && moderated.serverId)',
    );
    expect(adminRoute).toContain("after(async () =>");
    expect(adminRoute).toContain(
      "notifyServerFollowersOfPublishedContent(moderated)",
    );
    expect(createRoute).not.toContain(
      "notifyServerFollowersOfPublishedContent",
    );
  });

  it("bounds fanout, excludes the content author and respects server preferences", () => {
    const fanout = read(
      "apps/web/src/lib/services/server-follow-notification-service.ts",
    );
    const notifications = read(
      "packages/db/src/repositories/notifications.ts",
    );

    expect(fanout).toContain(
      "const MAX_SERVER_FOLLOWERS_PER_PUBLICATION = 100",
    );
    expect(fanout).toContain(
      "MAX_SERVER_FOLLOWERS_PER_PUBLICATION + 2",
    );
    expect(fanout).toContain(
      "const SERVER_FOLLOW_NOTIFICATION_CONCURRENCY = 10",
    );
    expect(fanout).toContain(
      "follow.followerId !== content.authorId",
    );
    expect(fanout.indexOf("eligibleFollowers.slice(")).toBeGreaterThan(
      fanout.indexOf("follow.followerId !== content.authorId"),
    );
    expect(fanout).toContain("Promise.all(");
    expect(fanout).toMatch(
      /socialRepository\.listFollowersByTarget\(\s*\n\s*"server",/,
    );
    expect(fanout).toContain("followerLimitReached");
    expect(notifications).toContain(
      'category === "server"',
    );
    expect(notifications).toContain(
      '"serverEnabled"',
    );
  });

  it("keeps notification delivery best-effort after the publication state transition", () => {
    const fanout = read(
      "apps/web/src/lib/services/server-follow-notification-service.ts",
    );
    const service = read(
      "apps/web/src/lib/services/content-service.ts",
    );

    expect(fanout).toContain("suppressedByPreference");
    expect(fanout).toContain("failed += 1");
    expect(fanout).toContain("deliverConfiguredWebPushNotification(created)");
    expect(fanout).toContain("pushFailed");
    expect(fanout).toContain("catch {");
    expect(service).not.toContain(
      "notifyServerFollowersOfPublishedContent",
    );
    expect(read("apps/web/src/app/api/admin/actions/route.ts")).toContain(
      "after(async () =>",
    );
  });

  it("does not notify followers for private or suspended servers", () => {
    const fanout = read(
      "apps/web/src/lib/services/server-follow-notification-service.ts",
    );

    expect(fanout).toContain('server.visibility === "private"');
    expect(fanout).toContain('server.status === "suspended"');
  });
});
