import type { Locale } from "../../lib/i18n";
import { organizationGovernanceMutationError } from "./organization-governance-copy";
import { organizationError } from "../../lib/organization-workspace-copy";
import { platformRequest } from "../../lib/user-platform-client";
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
