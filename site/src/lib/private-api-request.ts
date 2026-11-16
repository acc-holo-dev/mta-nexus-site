export type PrivateApiRequestOptions = {
  method?: string;
  json?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export function privateApiRequest(options: PrivateApiRequestOptions = {}): RequestInit {
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 60_000) {
    throw new RangeError("Invalid private API timeout");
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  const hasJson = options.json !== undefined;

  return {
    method: options.method ?? "GET",
    cache: "no-store",
    credentials: "same-origin",
    ...(hasJson
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(options.json),
        }
      : {}),
    signal,
  };
}
