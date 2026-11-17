import type { Locale } from "../../lib/i18n";
import { platformRequest } from "../../lib/user-platform-client";
import { organizationGovernanceMutationError } from "./organization-governance-copy";
import { organizationError } from "./organization-workspace-copy";
export function organizationRequest(
  path: string,
  locale: Locale,
  method = "GET",
  json?: unknown,
  signal?: AbortSignal,
  extraHeaders?: Record<string, string>,
) {
  return platformRequest(
    path,
    locale,
    method,
    json,
    signal,
    method === "GET" ? organizationError : organizationGovernanceMutationError,
    extraHeaders,
  );
}
