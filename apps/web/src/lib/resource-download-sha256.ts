/**
 * Verify the bytes the browser will actually save. HTTP lengths and the
 * server's SHA-256 header alone do not detect an altered download body.
 *
 * Web Crypto is intentionally used rather than a custom cryptographic
 * implementation. The download is capped at 64 MiB by the caller; digesting
 * the Blob may temporarily allocate another archive-sized ArrayBuffer.
 */
const SHA256_HEX = /^[a-fA-F0-9]{64}$/u;

export async function matchesDownloadedSha256(
  blob: Blob,
  expectedHeader: string | null,
  signal: AbortSignal,
): Promise<boolean> {
  signal.throwIfAborted();
  if (!expectedHeader || !SHA256_HEX.test(expectedHeader)) return false;

  try {
    const bytes = await blob.arrayBuffer();
    signal.throwIfAborted();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    signal.throwIfAborted();
    const actual = Array.from(
      new Uint8Array(digest),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    return actual === expectedHeader.toLowerCase();
  } catch {
    // A missing/disabled Web Crypto implementation is not a reason to
    // deliver unverified bytes; explicit cancellation takes precedence.
    signal.throwIfAborted();
    return false;
  }
}
