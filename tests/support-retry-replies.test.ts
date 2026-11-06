import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSupportRetry,
  reserveSupportCaseRetry,
  reserveSupportReplyRetry,
  type SupportRetryStorage,
} from "../apps/web/src/lib/support-retry";
import {
  SUPPORT_RETRY_ACTOR_A,
  SUPPORT_RETRY_CASE_ID,
  SUPPORT_RETRY_KEY_A,
  SUPPORT_RETRY_KEY_B,
  SUPPORT_RETRY_NOW,
  createSupportRetryStore,
} from "./helpers/support-retry-harness";

const NOW = SUPPORT_RETRY_NOW;
const CASE_ID = SUPPORT_RETRY_CASE_ID;
const A = SUPPORT_RETRY_KEY_A;
const B = SUPPORT_RETRY_KEY_B;
const ACTOR_A = SUPPORT_RETRY_ACTOR_A;

afterEach(() => vi.unstubAllGlobals());

describe("support retry reply recovery", () => {
  it("preserves the original expected status when staff resolves the thread", async () => {
    const storage = createSupportRetryStore();
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
    const storage = createSupportRetryStore();
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

  it("rejects invalid case IDs for reply reservations", () => {
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
    expect(() =>
      reserveSupportReplyRetry("invalid", "test", "open", {
        storage: denied,
        now: NOW,
        newKey: () => A,
      }),
    ).toThrow("Invalid support case id");
  });
});

it("reuses the original revision and key after an ambiguous reply even when the live case revision changes", async () => {
  const storage = createSupportRetryStore(),
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

it("rejects case and reply reservations when durable session storage cannot be read or written", async () => {
  const denied: SupportRetryStorage = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {},
  };
  const options = {
    storage: denied,
    actorScope: ACTOR_A,
    requirePersistence: true,
    now: NOW,
    newKey: () => A,
  };
  await expect(reserveSupportCaseRetry("case", options)).rejects.toThrow(
    "Support retry storage unavailable",
  );
  await expect(reserveSupportReplyRetry(CASE_ID, "reply", "open", options)).rejects.toThrow(
    "Support retry storage unavailable",
  );
  const noWrite: SupportRetryStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  await expect(reserveSupportCaseRetry("case", { ...options, storage: noWrite })).rejects.toThrow(
    "Support retry storage unavailable",
  );
  await expect(
    reserveSupportReplyRetry(CASE_ID, "reply", "open", { ...options, storage: noWrite }),
  ).rejects.toThrow("Support retry storage unavailable");
});
