import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server follower publication notifications", () => {
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
    expect(fanout).toContain("suppressedByPreference");
    expect(fanout).toContain("failed += 1");
    expect(fanout).toContain("deliverConfiguredWebPushNotification(created)");
    expect(fanout).toContain("pushFailed");
    expect(fanout).toContain("catch {");
  });

  it("does not notify followers for private or suspended servers", () => {
    const fanout = read(
      "apps/web/src/lib/services/server-follow-notification-service.ts",
    );

    expect(fanout).toContain('server.visibility === "private"');
    expect(fanout).toContain('server.status === "suspended"');
  });
});
