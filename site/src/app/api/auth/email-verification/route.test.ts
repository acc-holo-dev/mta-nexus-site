import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../tests/helpers/browser-mutation-headers";

const state = vi.hoisted(() => ({
  getSession: vi.fn(),
  getRecoveryEmailStatus: vi.fn(),
  requestRecoveryEmailVerification: vi.fn(),
}));
vi.mock("../../../../lib/services/auth-service", () => ({ authService: state }));

import { GET, POST } from "./route";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("binds private recovery email status to the authenticated account", async () => {
  state.getSession.mockResolvedValueOnce({ id: "usr_owner" });
  state.getRecoveryEmailStatus.mockResolvedValueOnce({
    email: "owner@example.test",
    verified: false,
    verifiedAt: null,
    eligible: true,
  });
  const response = await GET(
    new NextRequest("https://nexus.test/api/auth/email-verification", {
      headers: { cookie: "nexus_session=owner-session" },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(await response.json()).toMatchObject({
    actorId: "usr_owner",
    email: "owner@example.test",
  });
  expect(state.getRecoveryEmailStatus).toHaveBeenCalledExactlyOnceWith("usr_owner");
});

it("rejects a changed account before password verification or sending recovery email", async () => {
  stubBrowserMutationOrigin();
  state.getSession.mockResolvedValue({ id: "usr_other" });
  const request = (body: unknown) =>
    new NextRequest("https://nexus.test/api/auth/email-verification", {
      method: "POST",
      headers: {
        ...browserMutationHeaders(),
        cookie: "nexus_session=other-session",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const stale = await POST(
    request({ currentPassword: "shared-password", expectedActorId: "usr_owner" }),
  );
  expect(stale.status).toBe(409);
  expect(await stale.json()).toMatchObject({ code: "ACTOR_CHANGED" });
  expect(stale.headers.get("cache-control")).toBe("private, no-store");
  expect(stale.headers.get("vary")).toBe("Cookie");
  const oldClient = await POST(request({ currentPassword: "shared-password" }));
  expect(oldClient.status).toBe(400);
  expect(state.requestRecoveryEmailVerification).not.toHaveBeenCalled();
});

it("uses the authenticated user as the recovery request target when precondition matches", async () => {
  stubBrowserMutationOrigin();
  state.getSession.mockResolvedValue({ id: "usr_owner" });
  state.requestRecoveryEmailVerification.mockResolvedValue({ alreadyVerified: true });
  const response = await POST(
    new NextRequest("https://nexus.test/api/auth/email-verification", {
      method: "POST",
      headers: {
        ...browserMutationHeaders(),
        cookie: "nexus_session=owner-session",
        "content-type": "application/json",
      },
      body: JSON.stringify({ currentPassword: "shared-password", expectedActorId: "usr_owner" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(state.requestRecoveryEmailVerification).toHaveBeenCalledExactlyOnceWith({
    userId: "usr_owner",
    currentToken: "owner-session",
    currentPassword: "shared-password",
  });
});
