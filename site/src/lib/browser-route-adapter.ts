import type { NextRequest } from "next/server";
import { rejectUnsafeBrowserRequest } from "./browser-request-guard";

/** Stable marker for contract/inventory scans — browser cookie/session CSRF boundary. */
export const BROWSER_ROUTE_ADAPTER = "browser-csrf-v1" as const;

/**
 * Shared browser API mutation adapter.
 * Runs the HTTP provenance/CSRF guard before any body read, rate limit, or session work.
 * Do not wrap safe-method handlers that perform business writes — CSRF-safe GET must not
 * execute user commands; keep command mutations on POST/PUT/PATCH/DELETE through this adapter.
 */
export function withBrowserMutation<TArgs extends unknown[]>(
  handler: (request: NextRequest, ...args: TArgs) => Response | Promise<Response>,
): (request: NextRequest, ...args: TArgs) => Promise<Response> {
  return async (request, ...args) => {
    const rejected = rejectUnsafeBrowserRequest(request);
    if (rejected) return rejected;
    return handler(request, ...args);
  };
}
