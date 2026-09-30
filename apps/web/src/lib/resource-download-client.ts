import { MAX_UPLOAD_FILE_SIZE_BYTES } from "@nexus/domain";

export type DownloadFailure =
  | "signIn"
  | "access"
  | "missing"
  | "unavailable"
  | "rateLimit"
  | "failed";

export class ResourceDownloadError extends Error {
  constructor(public readonly reason: DownloadFailure) {
    super(reason);
  }
}

/** Read at most the supported archive size; never save partial/error responses. */
export async function fetchResourceDownload(
  productId: string,
  signal: AbortSignal,
  onProgress: (received: number, total: number | null) => void,
  request: typeof fetch = fetch,
): Promise<{ blob: Blob; fileName: string }> {
  const response = await request(`/api/products/${encodeURIComponent(productId)}/download`, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    await response.body?.cancel();
    const reasons: Record<number, DownloadFailure> = {
      401: "signIn",
      403: "access",
      404: "missing",
      409: "unavailable",
      429: "rateLimit",
    };
    throw new ResourceDownloadError(reasons[response.status] ?? "failed");
  }
  const mime = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (response.status !== 200 || mime === "text/html" || mime === "application/json") {
    await response.body?.cancel();
    throw new ResourceDownloadError("failed");
  }
  // Fetch exposes decoded bytes; a proxy may report the compressed wire length.
  const encoding = response.headers.get("Content-Encoding")?.toLowerCase();
  const header =
    !encoding || encoding === "identity" ? response.headers.get("Content-Length") : null;
  if (header !== null && !/^\d+$/.test(header)) {
    await response.body?.cancel();
    throw new ResourceDownloadError("failed");
  }
  const total = header !== null && /^\d+$/.test(header) ? Number(header) : null;
  if (
    total !== null &&
    (!Number.isSafeInteger(total) || total <= 0 || total > MAX_UPLOAD_FILE_SIZE_BYTES)
  ) {
    await response.body?.cancel();
    throw new ResourceDownloadError("failed");
  }
  if (!response.body) throw new ResourceDownloadError("failed");
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let received = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_UPLOAD_FILE_SIZE_BYTES || (total !== null && received > total)) {
        throw new ResourceDownloadError("failed");
      }
      chunks.push(Uint8Array.from(value).buffer);
      onProgress(received, total);
    }
    if (received === 0 || (total !== null && received !== total)) {
      throw new ResourceDownloadError("failed");
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const name = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1];
  const fileName =
    name && /^[a-zA-Z0-9._-]{1,200}$/.test(name) && !name.startsWith(".") ? name : "resource.zip";
  return {
    blob: new Blob(chunks, {
      type: response.headers.get("Content-Type") ?? "application/octet-stream",
    }),
    fileName,
  };
}
