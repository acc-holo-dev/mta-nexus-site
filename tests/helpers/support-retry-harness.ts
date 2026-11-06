import type { SupportRetryStorage } from "../../apps/web/src/lib/support-retry";

export const SUPPORT_RETRY_NOW = 1_797_000_000_000;
export const SUPPORT_RETRY_CASE_ID = `sup_${"a".repeat(24)}`;
export const SUPPORT_RETRY_KEY_A = "12345678-1234-4234-8234-123456789abc";
export const SUPPORT_RETRY_KEY_B = "12345678-1234-4234-8234-123456789abd";
export const SUPPORT_RETRY_ACTOR_A = "a".repeat(64);
export const SUPPORT_RETRY_ACTOR_B = "b".repeat(64);

/** In-memory SupportRetryStorage with dump/size helpers for focused suites. */
export function createSupportRetryStore(): SupportRetryStorage & {
  dump(): string;
  size(): number;
} {
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
