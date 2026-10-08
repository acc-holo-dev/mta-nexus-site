import { createHash } from "node:crypto";

export const SUPPORT_IDEMPOTENCY_HEADER = "Idempotency-Key";

// UUIDv4 keys are generated on the client per attempted mutation.
// Scope to the authenticated user and commit through a database unique key.
const uuidV4 = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u;

export function parseSupportIdempotencyKey(value: string | null): string | null {
  return value !== null && uuidV4.test(value) ? value : null;
}

export function supportMutationFingerprint(input:
  | { operation: "case"; category: string; subject: string; message: string }
  | { operation: "reply"; caseId: string; message: string; expectedStatus: string }
): string {
  return createHash("sha256").update(JSON.stringify(input), "utf8").digest("hex");
}
