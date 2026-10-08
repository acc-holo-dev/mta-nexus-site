import { describe, expect, it } from "vitest";
import {
  reserveSupportCaseRetry,
  reserveSupportReplyRetry,
  clearSupportRetry,
  type SupportRetryStorage,
} from "../apps/web/src/lib/support-retry";

const NOW = 1_797_000_000_000;
const CASE_ID = "sup_" + "a".repeat(24);
const A = "12345678-1234-4234-8234-123456789abc";
const B = "12345678-1234-4234-8234-123456789abd";

function store(): SupportRetryStorage & { dump(): string; size(): number } {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    dump: () => Array.from(values.values()).join("\n"),
    size: () => values.size,
  };
}

describe("support retry recovery across same-tab reload", () => {
  it("recovers original case request key without storing plaintext", async () => {
    const storage = store();
    const payload = JSON.stringify({
      category: "payment", subject: "Sensitive order", message: "Private support message",
    });
    const first = await reserveSupportCaseRetry(payload, { storage, now: NOW, newKey: () => A });
    const recovered = await reserveSupportCaseRetry(payload, {
      storage, now: NOW + 1_000, newKey: () => B,
    });
    expect(first).toEqual({ key: A, payload, recovered: false });
    expect(recovered).toEqual({ key: A, payload, recovered: true });
    expect(storage.dump()).not.toContain("Sensitive");
    expect(storage.dump()).not.toContain("Private support message");
    clearSupportRetry("case", A, { storage, now: NOW });
    expect(storage.size()).toBe(0);
  });

  it("does not let an obsolete request clear a newer changed-payload retry", async () => {
    const storage = store();
    await reserveSupportCaseRetry("old", { storage, now: NOW, newKey: () => A });
    const next = await reserveSupportCaseRetry("new", {
      storage, now: NOW, newKey: () => B,
    });
    expect(next.key).toBe(B);
    clearSupportRetry("case", A, { storage, now: NOW });
    expect(storage.size()).toBe(1);
    clearSupportRetry("case", B, { storage, now: NOW });
    expect(storage.size()).toBe(0);
  });

  it("preserves the original expected status when staff resolves the thread", async () => {
    const storage = store();
    await reserveSupportReplyRetry(CASE_ID, "Please help", "open", {
      storage, now: NOW, newKey: () => A,
    });
    const retry = await reserveSupportReplyRetry(CASE_ID, "Please help", "resolved", {
      storage, now: NOW + 250, newKey: () => B,
    });
    expect(retry.key).toBe(A);
    expect(retry.recovered).toBe(true);
    expect(JSON.parse(retry.payload).expectedStatus).toBe("open");
    expect(storage.dump()).not.toContain("Please help");
  });

  it("expires old keys and isolates changed reply content", async () => {
    const storage = store();
    await reserveSupportReplyRetry(CASE_ID, "old", "open", {
      storage, now: NOW, newKey: () => A,
    });
    const changed = await reserveSupportReplyRetry(CASE_ID, "new", "resolved", {
      storage, now: NOW + 1, newKey: () => B,
    });
    expect(changed).toMatchObject({ key: B, recovered: false });
    expect(JSON.parse(changed.payload).expectedStatus).toBe("resolved");
    const expired = await reserveSupportReplyRetry(CASE_ID, "new", "resolved", {
      storage, now: NOW + 86_400_002, newKey: () => A,
    });
    expect(expired).toMatchObject({ key: A, recovered: false });
  });

  it("handles unavailable storage and rejects invalid case IDs and keys", async () => {
    const denied: SupportRetryStorage = {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
    };
    expect((await reserveSupportCaseRetry("test", {
      storage: denied, now: NOW, newKey: () => A,
    })).key).toBe(A);
    expect(() => reserveSupportReplyRetry("invalid", "test", "open", {
      storage: denied, now: NOW, newKey: () => A,
    })).toThrow("Invalid support case id");
    await expect(reserveSupportCaseRetry("test", {
      storage: denied, now: NOW, newKey: () => "bad",
    })).rejects.toThrow("Invalid support retry key generator");
  });
});
