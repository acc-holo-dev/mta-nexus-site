import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  server: {
    id: "srv_1",
    name: "Nexus Racing",
    visibility: "public",
    status: "active",
  } as {
    id: string;
    name: string;
    visibility: string;
    status: string;
  } | null,
  followers: [] as Array<{
    followerId: string;
    targetType: "server";
    targetId: string;
  }>,
  activeCreates: 0,
  maxActiveCreates: 0,
}));

const findServer = vi.hoisted(() =>
  vi.fn(async () => state.server),
);
const listFollowers = vi.hoisted(() =>
  vi.fn(async () => state.followers),
);
const createNotification = vi.hoisted(() =>
  vi.fn(async (input: Record<string, unknown>) => {
    state.activeCreates += 1;
    state.maxActiveCreates = Math.max(
      state.maxActiveCreates,
      state.activeCreates,
    );
    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1);
      });
      if (input.recipientId === "usr_suppressed") {
        return { notification: null, pushJobs: 0 };
      }
      return {
        notification: {
          ...input,
          createdAt: new Date(),
          isRead: false,
        },
        pushJobs: input.recipientId === "usr_push_error" ? 0 : 1,
      };
    } finally {
      state.activeCreates -= 1;
    }
  }),
);
vi.mock("@nexus/db", () => ({
  notificationRepository: {
    createWithPushOutbox: createNotification,
  },
  serverRepository: {
    findById: findServer,
  },
  socialRepository: {
    listFollowersByTarget: listFollowers,
  },
}));

vi.mock("@nexus/security", () => ({
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

import { notifyServerFollowersOfPublishedContent } from "../apps/web/src/lib/services/server-follow-notification-service";

const content = {
  authorId: "usr_author",
  serverId: "srv_1",
  slug: "season-update",
  status: "published" as const,
  title: "Season update",
};

describe("server follower notification service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.server = {
      id: "srv_1",
      name: "Nexus Racing",
      visibility: "public",
      status: "active",
    };
    state.followers = [];
    state.activeCreates = 0;
    state.maxActiveCreates = 0;
  });

  it("skips unpublished content before any repository lookup", async () => {
    await expect(
      notifyServerFollowersOfPublishedContent({
        ...content,
        status: "draft",
      }),
    ).resolves.toMatchObject({
      attempted: 0,
      delivered: 0,
      skipped: true,
    });
    expect(findServer).not.toHaveBeenCalled();
    expect(listFollowers).not.toHaveBeenCalled();
  });

  it.each([
    ["private", "active"],
    ["public", "suspended"],
  ] as const)(
    "skips a %s/%s server",
    async (visibility, status) => {
      state.server = {
        id: "srv_1",
        name: "Nexus Racing",
        visibility,
        status,
      };

      await expect(
        notifyServerFollowersOfPublishedContent(content),
      ).resolves.toMatchObject({
        attempted: 0,
        skipped: true,
      });
      expect(listFollowers).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    },
  );

  it("bounds fanout, excludes the author and queues push jobs without network delivery", async () => {
    state.followers = [
      {
        followerId: "usr_author",
        targetType: "server",
        targetId: "srv_1",
      },
      {
        followerId: "usr_suppressed",
        targetType: "server",
        targetId: "srv_1",
      },
      {
        followerId: "usr_push_error",
        targetType: "server",
        targetId: "srv_1",
      },
      ...Array.from({ length: 99 }, (_, index) => ({
        followerId: `usr_${index}`,
        targetType: "server" as const,
        targetId: "srv_1",
      })),
    ];

    const result =
      await notifyServerFollowersOfPublishedContent(content);

    expect(listFollowers).toHaveBeenCalledWith(
      "server",
      "srv_1",
      102,
    );
    expect(result).toEqual({
      eligibleFollowers: 100,
      attempted: 100,
      delivered: 99,
      suppressedByPreference: 1,
      failed: 0,
      pushQueued: 98,
      followerLimitReached: true,
      skipped: false,
    });
    expect(createNotification).toHaveBeenCalledTimes(100);
    expect(state.maxActiveCreates).toBeLessThanOrEqual(10);
    expect(state.maxActiveCreates).toBeGreaterThan(1);
    expect(
      createNotification.mock.calls.some(
        ([input]) => input.recipientId === "usr_author",
      ),
    ).toBe(false);
  });
});
