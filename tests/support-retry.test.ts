import { afterEach, describe, expect, it, vi } from "vitest";
import {
  reserveSupportCaseRetry,
  reserveSupportReplyRetry,
  clearSupportRetry,
  resolveSupportRetryActorScope,
  type SupportRetryStorage,
} from "../apps/web/src/lib/support-retry";

const NOW = 1_797_000_000_000;
const CASE_ID = `sup_${"a".repeat(24)}`;
const A = "12345678-1234-4234-8234-123456789abc";
const B = "12345678-1234-4234-8234-123456789abd";
const ACTOR_A = "a".repeat(64);
const ACTOR_B = "b".repeat(64);

function store(): SupportRetryStorage & { dump(): string; size(): number } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    dump: () => Array.from(values.values()).join("\n"),
    size: () => values.size,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("support retry recovery across same-tab reload", () => {
  it("recovers original case request key without storing plaintext", async () => {
    const storage = store();
    const payload = JSON.stringify({
      category: "payment",
      subject: "Sensitive order",
      message: "Private support message",
    });
    const first = await reserveSupportCaseRetry(payload, {
      storage,
      actorScope: ACTOR_A,
      now: NOW,
      newKey: () => A,
    });
    const recovered = await reserveSupportCaseRetry(payload, {
      storage,
      actorScope: ACTOR_A,
      now: NOW + 1_000,
      newKey: () => B,
    });
    expect(first).toEqual({ key: A, payload, recovered: false });
    expect(recovered).toEqual({ key: A, payload, recovered: true });
    expect(storage.dump()).not.toContain("Sensitive");
    expect(storage.dump()).not.toContain("Private support message");
    clearSupportRetry("case", A, { storage, actorScope: ACTOR_A, now: NOW });
    expect(storage.size()).toBe(0);
  });

  it("does not let an obsolete request clear a newer changed-payload retry", async () => {
    const storage = store();
    await reserveSupportCaseRetry("old", {
      storage,
      actorScope: ACTOR_A,
      now: NOW,
      newKey: () => A,
    });
    const next = await reserveSupportCaseRetry("new", {
      storage,
      actorScope: ACTOR_A,
      now: NOW,
      newKey: () => B,
    });
    expect(next.key).toBe(B);
    clearSupportRetry("case", A, { storage, actorScope: ACTOR_A, now: NOW });
    expect(storage.size()).toBe(1);
    clearSupportRetry("case", B, { storage, actorScope: ACTOR_A, now: NOW });
    expect(storage.size()).toBe(0);
  });

  it("preserves the original expected status when staff resolves the thread", async () => {
    const storage = store();
    await reserveSupportReplyRetry(CASE_ID, "Please help", "open", {
      storage,
      actorScope: ACTOR_A,
      now: NOW,
      newKey: () => A,
    });
    const retry = await reserveSupportReplyRetry(CASE_ID, "Please help", "resolved", {
      storage,
      actorScope: ACTOR_A,
      now: NOW + 250,
      newKey: () => B,
    });
    expect(retry.key).toBe(A);
    expect(retry.recovered).toBe(true);
    expect(JSON.parse(retry.payload).expectedStatus).toBe("open");
    expect(storage.dump()).not.toContain("Please help");
  });

  it("expires old keys and isolates changed reply content", async () => {
    const storage = store();
    await reserveSupportReplyRetry(CASE_ID, "old", "open", {
      storage,
      actorScope: ACTOR_A,
      now: NOW,
      newKey: () => A,
    });
    const changed = await reserveSupportReplyRetry(CASE_ID, "new", "resolved", {
      storage,
      actorScope: ACTOR_A,
      now: NOW + 1,
      newKey: () => B,
    });
    expect(changed).toMatchObject({ key: B, recovered: false });
    expect(JSON.parse(changed.payload).expectedStatus).toBe("resolved");
    const expired = await reserveSupportReplyRetry(CASE_ID, "new", "resolved", {
      storage,
      actorScope: ACTOR_A,
      now: NOW + 86_400_002,
      newKey: () => A,
    });
    expect(expired).toMatchObject({ key: A, recovered: false });
  });

  it("handles unavailable storage and rejects invalid case IDs and keys", async () => {
    const denied: SupportRetryStorage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(
      (
        await reserveSupportCaseRetry("test", {
          storage: denied,
          now: NOW,
          newKey: () => A,
        })
      ).key,
    ).toBe(A);
    expect(() =>
      reserveSupportReplyRetry("invalid", "test", "open", {
        storage: denied,
        now: NOW,
        newKey: () => A,
      }),
    ).toThrow("Invalid support case id");
    await expect(
      reserveSupportCaseRetry("test", {
        storage: denied,
        now: NOW,
        newKey: () => "bad",
      }),
    ).rejects.toThrow("Invalid support retry key generator");
  });
  it("separates the same payload across accounts in one tab", async () => {
    const storage = store();
    const a = await reserveSupportCaseRetry("same payload", {
      storage,
      actorScope: ACTOR_A,
      now: NOW,
      newKey: () => A,
    });
    const b = await reserveSupportCaseRetry("same payload", {
      storage,
      actorScope: ACTOR_B,
      now: NOW,
      newKey: () => B,
    });
    expect(a.recovered).toBe(false);
    expect(b).toMatchObject({ key: B, recovered: false });
    expect(storage.size()).toBe(2);
    clearSupportRetry("case", A, { storage, actorScope: ACTOR_B, now: NOW });
    expect(storage.size()).toBe(2);
    clearSupportRetry("case", A, { storage, actorScope: ACTOR_A, now: NOW });
    expect(storage.size()).toBe(1);
    expect(
      (
        await reserveSupportCaseRetry("same payload", {
          storage,
          actorScope: ACTOR_B,
          now: NOW + 1_000,
          newKey: () => A,
        })
      ).key,
    ).toBe(B);
  });

  it("never persists or reuses a key without a verified actor", async () => {
    const storage = store();
    for (const actorScope of [null, undefined, "", "not-a-digest"]) {
      const attempt = await reserveSupportCaseRetry("same payload", {
        storage,
        actorScope,
        now: NOW,
        newKey: () => A,
      });
      expect(attempt.recovered).toBe(false);
      clearSupportRetry("case", A, { storage, actorScope, now: NOW });
    }
    expect(storage.size()).toBe(0);
  });

  it("resolves an opaque discriminator only for a valid authenticated session", async () => {
    const user = { authenticated: true, user: { id: `usr_${"1".repeat(24)}` } };
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify(user), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const a = await resolveSupportRetryActorScope();
    const b = await resolveSupportRetryActorScope();
    expect(a).toMatch(/^[a-f0-9]{64}$/u);
    expect(b).toBe(a);
    expect(a).not.toContain(user.user.id);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/session",
      expect.objectContaining({
        cache: "no-store",
        credentials: "same-origin",
      }),
    );

    for (const body of [
      { authenticated: false, user: null },
      { authenticated: true, user: { id: "invalid" } },
      { authenticated: true },
    ]) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
      expect(await resolveSupportRetryActorScope()).toBeNull();
    }
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect(await resolveSupportRetryActorScope()).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error("network unavailable"));
    expect(await resolveSupportRetryActorScope()).toBeNull();
  });
});

it("reuses the original revision and key after an ambiguous reply even when the live case revision changes", async () => {
  const storage = store(),
    firstVersion = "2026-10-11T00:00:00.000Z";
  const first = await reserveSupportReplyRetry(CASE_ID, "Sensitive retry message", "open", {
    storage,
    actorScope: ACTOR_A,
    now: NOW,
    newKey: () => A,
    expectedUpdatedAt: firstVersion,
  });
  const retry = await reserveSupportReplyRetry(CASE_ID, "Sensitive retry message", "resolved", {
    storage,
    actorScope: ACTOR_A,
    now: NOW + 250,
    newKey: () => B,
    expectedUpdatedAt: "2026-10-11T00:00:00.001Z",
  });
  expect(retry).toEqual({ ...first, recovered: true });
  expect(JSON.parse(retry.payload)).toMatchObject({
    expectedStatus: "open",
    expectedUpdatedAt: firstVersion,
  });
  expect(storage.dump()).not.toContain("Sensitive retry message");
  clearSupportRetry(`reply:${CASE_ID}`, A, { storage, actorScope: ACTOR_A, now: NOW + 500 });
  const next = await reserveSupportReplyRetry(CASE_ID, "Sensitive retry message", "resolved", {
    storage,
    actorScope: ACTOR_A,
    now: NOW + 500,
    newKey: () => B,
    expectedUpdatedAt: "2026-10-11T00:00:00.001Z",
  });
  expect(next.key).toBe(B);
  expect(JSON.parse(next.payload).expectedUpdatedAt).toBe("2026-10-11T00:00:00.001Z");
});
