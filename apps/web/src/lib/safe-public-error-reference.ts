/**
 * Next.js may attach an opaque `digest` suitable for support correlation (ERR-001).
 * Never invent a reference when absent, and never treat messages/stacks as IDs.
 */
export function readSafePublicErrorReference(
  error: { digest?: string } | null | undefined,
): string | null {
  const raw = error?.digest;
  if (typeof raw !== "string") return null;
  const digest = raw.trim();
  if (!digest) return null;
  // Opaque public token only — reject whitespace / oversized payloads.
  if (digest.length > 128 || /[\s\r\n]/u.test(digest)) return null;
  return digest;
}
