import type { AuthorDetailsDraft } from "./author-resource-draft";
import { privateRequest } from "./private-request";

export function authorDetailsMutationRequest(
  details: Omit<AuthorDetailsDraft, "tagsText"> & { tags: string[] },
  baseUpdatedAt: string,
  signal: AbortSignal,
): RequestInit {
  return privateRequest({
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "If-Match": `"${new Date(baseUpdatedAt).toISOString()}"`,
    },
    body: JSON.stringify(details),
    signal,
  });
}

export function authorBuildUploadRequest(
  body: FormData,
  signal: AbortSignal,
): RequestInit {
  return privateRequest({
    method: "POST",
    body,
    signal,
  });
}

export function authorBuildRetireRequest(
  reason: string,
  signal: AbortSignal,
): RequestInit {
  return privateRequest({
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "retire",
      reason,
    }),
    signal,
  });
}
