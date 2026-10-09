import { MAX_UPLOAD_FILE_SIZE_BYTES } from "@nexus/domain";
import { resourceDownloadUrl } from "./build-download-selection";
import { matchesDownloadedSha256 } from "./resource-download-sha256";

export type DownloadFailure =
  | "signIn"
  | "access"
  | "missing"
  | "unavailable"
  | "rateLimit"
  | "timeout"
  | "failed";

export class ResourceDownloadError extends Error {
  constructor(public readonly reason: DownloadFailure) {
    super(reason);
  }
}

export const DOWNLOAD_IDLE_TIMEOUT_MS = 60_000;

/** Read at most the supported archive size; never save partial/error responses. */
export async function fetchResourceDownload(
  productId: string,
  signal: AbortSignal,
  onProgress: (received: number, total: number | null) => void,
  request: typeof fetch = fetch,
  buildId?: string,
): Promise<{ blob: Blob; fileName: string }> {
  signal.throwIfAborted();
  const active = new AbortController();
  const cancel = () => active.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resetTimeout = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      active.abort();
    }, DOWNLOAD_IDLE_TIMEOUT_MS);
  };
  resetTimeout();
  try {
    return await readResourceDownload(productId, active.signal, (received, total) => {
      resetTimeout();
      onProgress(received, total);
    }, request, buildId);
  } catch (error) {
    // Explicit cancellation takes precedence over a concurrent idle timeout.
    signal.throwIfAborted();
    if (timedOut) throw new ResourceDownloadError("timeout");
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

async function readResourceDownload(
  productId: string,
  signal: AbortSignal,
  onProgress: (received: number, total: number | null) => void,
  request: typeof fetch,
  buildId?: string,
): Promise<{ blob: Blob; fileName: string }> {
  signal.throwIfAborted();
  const response = await request(resourceDownloadUrl(productId, buildId), {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    void response.body?.cancel().catch(() => undefined);
    const reasons: Record<number, DownloadFailure> = {
      401: "signIn",
      403: "access",
      404: "missing",
      409: "unavailable",
      429: "rateLimit",
    };
    throw new ResourceDownloadError(reasons[response.status] ?? "failed");
  }
  // A selected older version must never be silently replaced by a different
  // build (for example because of a stale proxy or a route regression).
  if (buildId && response.headers.get("X-Resource-Build-Id") !== buildId) {
    void response.body?.cancel().catch(() => undefined);
    throw new ResourceDownloadError("failed");
  }
  const mime = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (response.status !== 200 || mime === "text/html" || mime === "application/json") {
    void response.body?.cancel().catch(() => undefined);
    throw new ResourceDownloadError("failed");
  }
  // Fetch exposes decoded bytes; a proxy may report the compressed wire length.
  const encoding = response.headers.get("Content-Encoding")?.toLowerCase();
  const header =
    !encoding || encoding === "identity" ? response.headers.get("Content-Length") : null;
  if (header !== null && !/^\d+$/.test(header)) {
    void response.body?.cancel().catch(() => undefined);
    throw new ResourceDownloadError("failed");
  }
  const total = header !== null && /^\d+$/.test(header) ? Number(header) : null;
  if (
    total !== null &&
    (!Number.isSafeInteger(total) || total <= 0 || total > MAX_UPLOAD_FILE_SIZE_BYTES)
  ) {
    void response.body?.cancel().catch(() => undefined);
    throw new ResourceDownloadError("failed");
  }
  if (!response.body) throw new ResourceDownloadError("failed");
  const reader = response.body.getReader();
  // A wrapped response stream need not inherit fetch's AbortSignal. Cancel the
  // reader directly so a pending read can finish even without another chunk.
  const cancel = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();
  const chunks: Blob[] = [];
  let received = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      // Empty chunks are not progress and must not extend the idle deadline.
      if (value.byteLength === 0) continue;
      received += value.byteLength;
      if (received > MAX_UPLOAD_FILE_SIZE_BYTES || (total !== null && received > total)) {
        throw new ResourceDownloadError("failed");
      }
      // Snapshot each block without retaining a separate archive-sized array of
      // ArrayBuffers. The browser controls Blob storage and its reclamation.
      chunks.push(new Blob([value as Uint8Array<ArrayBuffer>]));
      onProgress(received, total);
    }
    if (received === 0 || (total !== null && received !== total)) {
      throw new ResourceDownloadError("failed");
    }
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  const name = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1];
  const fileName =
    name && /^[a-zA-Z0-9._-]{1,200}$/.test(name) && !name.startsWith(".") ? name : "resource.zip";
  const blob = new Blob(chunks, {
    type: response.headers.get("Content-Type") ?? "application/octet-stream",
  });
  // The HTTP length protects against truncation, not same-length corruption.
  // Do not hand an unverified artifact to the browser's save dialog.
  const validHash = await matchesDownloadedSha256(
    blob,
    response.headers.get("X-Content-SHA256"),
    signal,
  );
  signal.throwIfAborted();
  if (!validHash) throw new ResourceDownloadError("failed");
  return { blob, fileName };
}
