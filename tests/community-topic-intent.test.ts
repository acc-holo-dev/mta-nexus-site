import { afterEach, expect, it, vi } from "vitest";
import {
  clearCommunityTopicIntent,
  readCommunityTopicIntent,
  writeCommunityTopicIntent,
} from "../site/src/lib/community-topic-intent";

const intent = {
  actorId: "usr_a",
  draft: {
    title: "Draft topic",
    body: "A sufficiently long body",
    type: "post" as const,
    tags: "help, lua",
  },
  submission: {
    title: "Draft topic",
    slug: `draft-topic-123-${"a".repeat(32)}`,
    body: "A sufficiently long body",
    type: "post" as const,
    tags: ["help", "lua"],
  },
};
afterEach(() => vi.unstubAllGlobals());
it("restores a pending topic only for its originating actor and clears it explicitly", () => {
  const entries = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  });
  expect(writeCommunityTopicIntent(intent)).toBe(true);
  expect(readCommunityTopicIntent("usr_a")).toEqual({ available: true, intent });
  expect(readCommunityTopicIntent("usr_b")).toEqual({ available: true, intent: null });
  expect(clearCommunityTopicIntent("usr_a")).toBe(true);
  expect(readCommunityTopicIntent("usr_a")).toEqual({ available: true, intent: null });
});
it("fails closed on unavailable or tampered pending storage", () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => "{bad",
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {
      throw Error("denied");
    },
  });
  expect(readCommunityTopicIntent("usr_a")).toEqual({ available: false, intent: null });
  expect(writeCommunityTopicIntent(intent)).toBe(false);
  expect(clearCommunityTopicIntent("usr_a")).toBe(false);
});
