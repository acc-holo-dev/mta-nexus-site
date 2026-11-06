import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSupportRetry,
  reserveSupportCaseRetry,
  resolveSupportRetryActorScope,
} from "../apps/web/src/lib/support-retry";
import {
  SUPPORT_RETRY_ACTOR_A,
  SUPPORT_RETRY_ACTOR_B,
  SUPPORT_RETRY_KEY_A,
  SUPPORT_RETRY_KEY_B,
  SUPPORT_RETRY_NOW,
  createSupportRetryStore,
} from "./helpers/support-retry-harness";

const NOW = SUPPORT_RETRY_NOW;
const A = SUPPORT_RETRY_KEY_A;
const B = SUPPORT_RETRY_KEY_B;
const ACTOR_A = SUPPORT_RETRY_ACTOR_A;
const ACTOR_B = SUPPORT_RETRY_ACTOR_B;

afterEach(() => vi.unstubAllGlobals());

describe("support retry case recovery and actor isolation", () => {
  it("recovers original case request key without storing plaintext", async () => {
    const storage = createSupportRetryStore();
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
    const storage = createSupportRetryStore();
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

  it("handles unavailable storage and rejects invalid case IDs and keys", async () => {
    const denied = {
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
    await expect(
      reserveSupportCaseRetry("test", {
        storage: denied,
        now: NOW,
        newKey: () => "bad",
      }),
    ).rejects.toThrow("Invalid support retry key generator");
  });

  it("separates the same payload across accounts in one tab", async () => {
    const storage = createSupportRetryStore();
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
    const storage = createSupportRetryStore();
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

it("does not overwrite a different actor retry slot after the session changes", async () => {
  const actorA = `usr_${"1".repeat(24)}`;
  const actorB = `usr_${"2".repeat(24)}`;
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ authenticated: true, user: { id: actorB } }), {
          status: 200,
        }),
    ),
  );
  const storage = createSupportRetryStore();
  const scopeB = await resolveSupportRetryActorScope(actorB);
  expect(scopeB).toBeTruthy();
  await reserveSupportCaseRetry("existing B request", {
    actorScope: scopeB,
    storage,
    now: NOW,
    newKey: () => B,
  });
  const before = storage.dump();
  const scopeForA = await resolveSupportRetryActorScope(actorA);
  expect(scopeForA).toBeNull();
  await reserveSupportCaseRetry("private A request", {
    actorScope: scopeForA,
    storage,
    now: NOW,
    newKey: () => A,
  });
  expect(storage.dump()).toBe(before);
});
