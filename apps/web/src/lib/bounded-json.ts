import { AppError } from "@nexus/domain";

/** Maximum accepted bytes for a server listing's JSON metadata mutation. */
export const SERVER_MUTATION_MAX_BODY_BYTES = 32 * 1024;

function tooLarge(): AppError {
  return new AppError("Server request body exceeds 32 KiB", 413, "REQUEST_BODY_TOO_LARGE");
}

/**
 * Reads untrusted JSON with a real byte ceiling, independently of
 * Content-Length. Body cancellation is intentionally fire-and-forget:
 * a malicious upstream stream can stall forever during cancel().
 */
export async function readBoundedJson(
  request: Request,
  maxBytes = SERVER_MUTATION_MAX_BODY_BYTES,
): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new RangeError("Invalid JSON request byte limit");
  }

  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(declared) ||
      !Number.isSafeInteger(Number(declared))) {
      throw new AppError("Invalid Content-Length", 400, "INVALID_BODY_LENGTH");
    }
    if (Number(declared) > maxBytes) {
      void request.body?.cancel().catch(() => {});
      throw tooLarge();
    }
  }

  if (!request.body) return null;
  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  request.signal.addEventListener("abort", cancel, { once: true });
  if (request.signal.aborted) cancel();

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      request.signal.throwIfAborted();
      const { done, value } = await reader.read();
      request.signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw tooLarge();
      chunks.push(value);
    }
  } catch (error) {
    cancel();
    throw error;
  } finally {
    request.signal.removeEventListener("abort", cancel);
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
