type RunResult = { blocked: boolean; checkpoint: { completed: boolean } };

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
    } catch {
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
