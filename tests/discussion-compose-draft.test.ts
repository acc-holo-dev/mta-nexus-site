import { describe, expect, it } from "vitest";
import {
  clearDiscussionComposeDraft,
  type DiscussionComposeDraftStore,
  parseDiscussionComposeDraft,
  readDiscussionComposeDraft,
  writeDiscussionComposeDraft,
} from "../apps/web/src/lib/discussion-compose-draft";

function memoryStore(): DiscussionComposeDraftStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe("discussion compose draft", () => {
  it("round-trips a guest draft for one content id", () => {
    const store = memoryStore();
    expect(
      writeDiscussionComposeDraft(
        {
          contentId: "cnt_demo",
          text: "Hello after sign-in",
          parentId: "cmt_parent",
          parentName: "@author",
        },
        { store, now: 1_000 },
      ),
    ).toBe(true);
    expect(readDiscussionComposeDraft("cnt_demo", { store, now: 1_500 })).toEqual({
      version: 1,
      contentId: "cnt_demo",
      text: "Hello after sign-in",
      parentId: "cmt_parent",
      parentName: "@author",
      savedAt: 1_000,
    });
  });

  it("round-trips a publish intent key for post-auth retry", () => {
    const store = memoryStore();
    const intentKey = "12345678-1234-4234-8234-123456789abc";
    writeDiscussionComposeDraft(
      { contentId: "cnt_demo", text: "Retry me", intentKey },
      { store, now: 5_000 },
    );
    expect(readDiscussionComposeDraft("cnt_demo", { store, now: 5_500 })).toEqual({
      version: 1,
      contentId: "cnt_demo",
      text: "Retry me",
      intentKey,
      savedAt: 5_000,
    });
  });

  it("rejects malformed intent keys in stored payloads", () => {
    expect(
      parseDiscussionComposeDraft(
        JSON.stringify({
          version: 1,
          contentId: "cnt_demo",
          text: "kept",
          intentKey: "not-a-uuid",
          savedAt: 1_000,
        }),
        "cnt_demo",
        2_000,
      ),
    ).toBeNull();
  });

  it("rejects foreign content, expired, and oversized payloads", () => {
    expect(
      parseDiscussionComposeDraft(
        JSON.stringify({
          version: 1,
          contentId: "cnt_a",
          text: "kept",
          savedAt: 1_000,
        }),
        "cnt_b",
        2_000,
      ),
    ).toBeNull();
    expect(
      parseDiscussionComposeDraft(
        JSON.stringify({
          version: 1,
          contentId: "cnt_a",
          text: "kept",
          savedAt: 1_000,
        }),
        "cnt_a",
        1_000 + 25 * 60 * 60 * 1000,
      ),
    ).toBeNull();
    expect(parseDiscussionComposeDraft("not-json", "cnt_a")).toBeNull();
  });

  it("clears draft after publish without inventing auto-submit", () => {
    const store = memoryStore();
    writeDiscussionComposeDraft(
      { contentId: "cnt_demo", text: "ready to send later" },
      { store, now: 10 },
    );
    clearDiscussionComposeDraft("cnt_demo", { store });
    expect(readDiscussionComposeDraft("cnt_demo", { store, now: 20 })).toBeNull();
    expect(store.data.size).toBe(0);
  });
});
it("isolates drafts and pending keys by actor while leaving the guest slot separate", () => {
  const store = memoryStore();
  const intentKey = "12345678-1234-4234-8234-123456789abc";
  writeDiscussionComposeDraft(
    { contentId: "cnt_demo", text: "Private actor A", intentKey },
    { store, actorId: "usr_a", now: 1000 },
  );
  writeDiscussionComposeDraft({ contentId: "cnt_demo", text: "Guest text" }, { store, now: 1000 });
  expect(readDiscussionComposeDraft("cnt_demo", { store, actorId: "usr_b", now: 1001 })).toBeNull();
  expect(
    readDiscussionComposeDraft("cnt_demo", { store, actorId: "usr_a", now: 1001 }),
  ).toMatchObject({ text: "Private actor A", intentKey });
  expect(readDiscussionComposeDraft("cnt_demo", { store, now: 1001 })).toMatchObject({
    text: "Guest text",
  });
});
it("does not claim recoverability when persistent storage cannot write", () => {
  const denied: DiscussionComposeDraftStore = {
    getItem: () => null,
    setItem: () => {
      throw Error("denied");
    },
    removeItem: () => {},
  };
  expect(
    writeDiscussionComposeDraft(
      {
        contentId: "cnt_demo",
        text: "Pending comment",
        intentKey: "12345678-1234-4234-8234-123456789abc",
      },
      { store: denied, actorId: "usr_a", requirePersistence: true },
    ),
  ).toBe(false);
  const noWrite: DiscussionComposeDraftStore = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  expect(
    writeDiscussionComposeDraft(
      { contentId: "cnt_demo", text: "Pending comment" },
      { store: noWrite, actorId: "usr_a", requirePersistence: true },
    ),
  ).toBe(false);
});
it("does not load or remove an unscoped legacy draft when a different actor signs in", () => {
  const store = memoryStore();
  const legacyKey = "nexus:discussion:compose:v1:cnt_demo";
  store.setItem(
    legacyKey,
    JSON.stringify({ version: 1, contentId: "cnt_demo", text: "Old private text", savedAt: 1000 }),
  );
  expect(readDiscussionComposeDraft("cnt_demo", { store, actorId: "usr_b", now: 1001 })).toBeNull();
  expect(store.getItem(legacyKey)).toContain("Old private text");
});
it("keeps an unresolved intent past the normal draft expiry", () => {
  const store = memoryStore();
  const intentKey = "12345678-1234-4234-8234-123456789abc";
  writeDiscussionComposeDraft(
    { contentId: "cnt_demo", text: "Pending comment", intentKey },
    { store, actorId: "usr_a", now: 1000 },
  );
  expect(
    readDiscussionComposeDraft("cnt_demo", {
      store,
      actorId: "usr_a",
      now: 1000 + 25 * 60 * 60 * 1000,
    }),
  ).toMatchObject({ text: "Pending comment", intentKey });
});
