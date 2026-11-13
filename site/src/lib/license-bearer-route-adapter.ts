import type { NextRequest } from "next/server";
import { licenseRuntimeRequest } from "./license-runtime-http";

/** Stable marker for contract/inventory scans — machine/bearer license boundary. */
export const LICENSE_BEARER_ROUTE_ADAPTER = "license-bearer-v1" as const;

/**
 * Independent of browser CSRF. Cookies never replace a runtime bearer token.
 * An Authorization header on any other API still does not bypass browser CSRF.
 */
export function withLicenseBearerRoute(
  operation: (digest: string, request: NextRequest) => Promise<unknown | null>,
): (request: NextRequest) => Promise<Response> {
  return (request) => licenseRuntimeRequest(request, (digest) => operation(digest, request));
}
