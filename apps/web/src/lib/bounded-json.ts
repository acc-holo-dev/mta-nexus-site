import { AppError } from "@nexus/domain";

/**
 * Server write endpoints accept only application/json. In addition to
 * validation, this prevents browser form encodings from being interpreted
 * as authenticated API commands.
 */
export function requireServerJsonContentType(request: Pick<Request, "headers">): void {
  const value = request.headers.get("content-type");
  if (
    value === null ||
    value.length > 256 ||
    value.split(";", 1)[0]?.trim().toLowerCase() !== "application/json"
  ) {
    throw new AppError("Content-Type application/json is required", 415, "UNSUPPORTED_MEDIA_TYPE");
  }
}

/** Maximum accepted bytes for a server listing's JSON metadata mutation. */
export const SERVER_MUTATION_MAX_BODY_BYTES = 32 * 1024;

function tooLarge(): AppError {
  return new AppError("Server request body exceeds 32 KiB", 413, "REQUEST_BODY_TOO_LARGE");
}

function timedOut(): AppError {
  return new AppError("Server request body timed out", 408, "REQUEST_BODY_TIMEOUT");
}

/**
 * Reads untrusted JSON with a real byte ceiling, independently of
 * Content-Length. Body cancellation is intentionally fire-and-forget:
 * a malicious upstream stream can stall forever during cancel().
 */
export async function readBoundedJson(
  request: Request,
  maxBytes = SERVER_MUTATION_MAX_BODY_BYTES,
  timeoutMs = 10_000,
): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("Invalid JSON request byte limit");
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new RangeError("Invalid JSON request timeout");
  }
  request.signal.throwIfAborted();

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(declared) || !Number.isSafeInteger(Number(declared))) {
      void request.body?.cancel().catch(() => {});
      throw new AppError("Invalid Content-Length", 400, "INVALID_BODY_LENGTH");
    }
    if (Number(declared) > maxBytes) {
      void request.body?.cancel().catch(() => {});
      throw tooLarge();
    }
  }

  if (!request.body) return null;
  const reader = request.body.getReader();
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = AbortSignal.any([request.signal, timeoutSignal]);
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  const throwIfAborted = () => {
    request.signal.throwIfAborted();
    if (timeoutSignal.aborted) throw timedOut();
  };
  signal.addEventListener("abort", cancel, { once: true });
  if (signal.aborted) cancel();

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      throwIfAborted();
      const { done, value } = await reader.read();
      throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw tooLarge();
      chunks.push(value);
    }
  } catch (error) {
    cancel();
    throwIfAborted();
    throw error;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    // Match the existing request.json().catch(() => null) API contract.
    return null;
  }
}

// Preserve the support API tagged-result contract alongside server mutation errors.
export const SUPPORT_JSON_MAX_BYTES = 32 * 1024;

export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "invalid" | "too_large" };

/** Limits actual streamed JSON bytes before allocating or parsing a request body. */
export async function parseBoundedJson(
  request: Request,
  maxBytes = SUPPORT_JSON_MAX_BYTES,
): Promise<BoundedJsonResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new RangeError("Invalid JSON body limit");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/u.test(declaredLength)) return { ok: false, reason: "invalid" };
    if (declaredLength.length > 16 || Number(declaredLength) > maxBytes) {
      return { ok: false, reason: "too_large" };
    }
  }
  if (!request.body) return { ok: false, reason: "invalid" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      if (value.byteLength > maxBytes - totalBytes) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      totalBytes += value.byteLength;
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return {
      ok: true,
      value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)),
    };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
