type RunResult = { blocked: boolean; checkpoint: { completed: boolean } };

/** Failed durable progress must be inspected, even if its I/O code resembles a network timeout. */
export class DiscussionReplayPermanentError extends Error {}

const retryCodes = new Set([
  "08000",
  "08001",
  "08003",
  "08006",
  "08007", // Connection failures, excluding rejected/protocol-invalid connections.
  "40001",
  "40P01", // Serialization conflict / deadlock.
  "53100",
  "53200",
  "53300", // Temporary server capacity.
  "55P03",
  "57014",
  "57P01",
  "57P02",
  "57P03", // Lock, query timeout, server restarting.
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EAI_AGAIN",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_DESTROYED",
]);

/** Drizzle wraps driver failures in cause; unknown, filesystem and invariant failures stop. */
export function isRetryableDiscussionReplayFailure(error: unknown) {
  const seen = new Set<unknown>();
  for (let depth = 0; depth < 4 && error && typeof error === "object"; depth++) {
    if (error instanceof DiscussionReplayPermanentError) return false;
    if (seen.has(error)) return false;
    seen.add(error);
    const value = error as { code?: unknown; cause?: unknown };
    if (typeof value.code === "string") return retryCodes.has(value.code);
    error = value.cause;
  }
  return false;
}

/** One fixed recovery window; transient failures never advance its checkpoint. */
export async function runDiscussionReplayWorker(dependencies: {
  run: () => Promise<RunResult>;
  stopped: () => boolean;
  wait: (milliseconds: number) => Promise<void>;
  reportFailure: () => void;
}) {
  let failures = 0;
  while (!dependencies.stopped()) {
    let result: RunResult | undefined;
    try {
      result = await dependencies.run();
    } catch (error) {
      if (!isRetryableDiscussionReplayFailure(error)) throw error;
      // Keep provider details and private payloads out of worker logs.
    }
    if (result?.checkpoint.completed) return { completed: true };
    if (!result || result.blocked) {
      failures++;
      dependencies.reportFailure();
    } else failures = 0;
    if (!dependencies.stopped())
      await dependencies.wait(
        failures ? Math.min(60000, 1000 * 2 ** Math.min(failures - 1, 6)) : 1000,
      );
  }
  return { completed: false };
}
