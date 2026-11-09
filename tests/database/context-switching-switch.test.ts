import { describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/lib/services/auth-service", async () => {
  const { createContextSwitchingAuthMock } = await import("../helpers/context-switching-harness");
  return createContextSwitchingAuthMock();
});

vi.mock("@nexus/db", async () => {
  const { createContextSwitchingDbMock } = await import("../helpers/context-switching-harness");
  return createContextSwitchingDbMock();
});

vi.mock("@nexus/security", async () => {
  const { createContextSwitchingSecurityMock } = await import(
    "../helpers/context-switching-harness"
  );
  return createContextSwitchingSecurityMock();
});

import { POST } from "../../apps/web/src/app/api/auth/context/route";
import {
  contextSwitchingMocks,
  expectContextSwitchingPrivateCorrelation as expectPrivateCorrelation,
  installContextSwitchingLifecycle,
  contextSwitchingPostRequest as postRequest,
  contextSwitchingState as state,
} from "../helpers/context-switching-harness";

const { getSession, getSessionIdentity, switchContext } = contextSwitchingMocks;

installContextSwitchingLifecycle();

describe("account context switching mutation HTTP contract", () => {
  it("validates and rate-limits context switches before mutation", async () => {
    const malformed = await POST(
      postRequest({
        contextId: "org_member",
        expectedActorId: "usr_context",
        extra: true,
      }),
    );
    expect(malformed.status).toBe(400);
    expectPrivateCorrelation(malformed);
    expect(switchContext).not.toHaveBeenCalled();

    state.allowed = false;
    const limited = await POST(
      postRequest({ contextId: "org_member", expectedActorId: "usr_context" }),
    );
    expect(limited.status).toBe(429);
    expectPrivateCorrelation(limited);
    expect(switchContext).not.toHaveBeenCalled();
  });

  it("returns the authoritative switched context with request correlation", async () => {
    const response = await POST(
      postRequest({ contextId: "org_member", expectedActorId: "usr_context" }),
    );

    expect(response.status).toBe(200);
    expectPrivateCorrelation(response);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      actorId: "usr_context",
      activeContextId: "org_member",
    });
    expect(getSessionIdentity).toHaveBeenCalledOnce();
    expect(getSessionIdentity).toHaveBeenCalledWith("context-token");
    expect(getSession).not.toHaveBeenCalled();
    expect(switchContext).toHaveBeenCalledWith("usr_context", "org_member", "context-token");
  });

  it("does not switch context without a session identity", async () => {
    state.user = null;
    const response = await POST(
      postRequest({ contextId: "org_member", expectedActorId: "usr_context" }),
    );
    expect(response.status).toBe(401);
    expectPrivateCorrelation(response);
    expect(getSessionIdentity).toHaveBeenCalledWith("context-token");
    expect(switchContext).not.toHaveBeenCalled();
  });

  it("rejects context selection made for a previous account", async () => {
    const response = await POST(
      postRequest({ contextId: "personal", expectedActorId: "usr_previous" }),
    );
    expect(response.status).toBe(409);
    expectPrivateCorrelation(response);
    expect(await response.json()).toMatchObject({ code: "ACTOR_CHANGED" });
    expect(switchContext).not.toHaveBeenCalled();
    const oldClient = await POST(postRequest({ contextId: "personal" }));
    expect(oldClient.status).toBe(400);
    expect(switchContext).not.toHaveBeenCalled();
  });
});
