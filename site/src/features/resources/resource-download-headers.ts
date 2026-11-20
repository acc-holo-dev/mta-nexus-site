/**
 * Next.js 16.4.5+ strips Content-Length from Route Handler responses
 * (FORBIDDEN_HEADERS in send-response). Keep an application-owned size header
 * so download progress and CI probes still see the exact archived byte count.
 */
export const RESOURCE_CONTENT_LENGTH_HEADER = "X-Resource-Content-Length";

/** Prefer wire Content-Length when present; otherwise the resource size header. */
export function resolveResourceDownloadContentLength(
  headers: Headers | { get(name: string): string | null },
): string | null {
  const contentLength = headers.get("Content-Length") ?? headers.get("content-length");
  if (contentLength !== null && contentLength !== undefined && contentLength !== "") {
    return contentLength;
  }
  return (
    headers.get(RESOURCE_CONTENT_LENGTH_HEADER) ??
    headers.get(RESOURCE_CONTENT_LENGTH_HEADER.toLowerCase())
  );
}
