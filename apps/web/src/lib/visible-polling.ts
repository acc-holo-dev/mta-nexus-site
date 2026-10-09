type VisibilitySource = Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">;

type PollingOptions<T> = {
  read(signal: AbortSignal): Promise<T>;
  onValue(value: T): void;
  onError(error: unknown): void;
  intervalMs?: number;
  visibility?: VisibilitySource;
};

/** One cancellable read at a time; the next delay starts after completion. */
export function startVisiblePolling<T>({
  read,
  onValue,
  onError,
  intervalMs = 30_000,
  visibility = document,
}: PollingOptions<T>): () => void {
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1 || intervalMs > 2_147_483_647) {
    throw new RangeError("Invalid polling interval");
  }
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: AbortController | null = null;
  const visible = () => visibility.visibilityState === "visible";
  const clearTimer = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const cancelRead = () => {
    const previous = current;
    current = null;
    previous?.abort();
  };

  function refresh() {
    if (stopped || !visible() || current) return;
    clearTimer();
    const controller = new AbortController();
    current = controller;
    const relevant = () => !stopped && current === controller && !controller.signal.aborted && visible();
    void (async () => {
      try {
        const value = await read(controller.signal);
        if (relevant()) onValue(value);
      } catch (error) {
        if (relevant()) onError(error);
      } finally {
        // A cancelled read may settle after a newer visibility refresh.
        if (current === controller) {
          current = null;
          if (!stopped && visible()) timer = setTimeout(refresh, intervalMs);
        }
      }
    })();
  }

  function visibilityChanged() {
    clearTimer();
    if (visible()) refresh();
    else cancelRead();
  }
  visibility.addEventListener("visibilitychange", visibilityChanged);
  refresh();
  return () => {
    stopped = true;
    clearTimer();
    cancelRead();
    visibility.removeEventListener("visibilitychange", visibilityChanged);
  };
}
