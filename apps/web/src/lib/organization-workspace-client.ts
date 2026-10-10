import type { Locale } from "./i18n";
import { organizationGovernanceMutationError } from "./organization-governance-copy";
import { organizationError } from "./organization-workspace-copy";
import { platformRequest } from "./user-platform-client";
export function organizationRequest(
  path: string,
  locale: Locale,
  method = "GET",
  json?: unknown,
  signal?: AbortSignal,
) {
  return platformRequest(
    path,
    locale,
    method,
    json,
    signal,
    method === "GET" ? organizationError : organizationGovernanceMutationError,
  );
}
