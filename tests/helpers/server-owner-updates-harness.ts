import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "../browser-mutation-headers";

export const serverOwnerUpdatesState = {
  user: {
    id: "usr_server_owner",
    role: "developer",
  } as Record<string, unknown> | null,
  allowed: true,
};

export const serverOwnerUpdatesUpdateServer = vi.fn(async (_id, input) => ({
  id: "srv_1",
  ...input,
}));

export const serverOwnerUpdatesGetManagedServerDetails = vi.fn();

export const serverOwnerUpdatesRouteContext = {
  params: Promise.resolve({ id: "srv_1" }),
};

export function serverOwnerUpdatesRequest(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/servers/srv_1", {
    method: "PATCH",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=server-owner-token",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

export function expectServerOwnerUpdatesPrivateCorrelation(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{20,}$/u);
}

export function installServerOwnerUpdatesLifecycle() {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    serverOwnerUpdatesState.user = {
      id: "usr_server_owner",
      role: "developer",
    };
    serverOwnerUpdatesState.allowed = true;
    serverOwnerUpdatesGetManagedServerDetails.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
}
