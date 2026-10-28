import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: {
    id: "usr_session",
    username: "session-user",
  } as { id: string; username: string } | null,
  readFails: false,
  logoutFails: false,
}));

const getSession = vi.hoisted(() =>
  vi.fn(async () => {
    if (state.readFails) {
      throw new Error("database unavailable");
    }
    return state.user;
  }),
);
const logout = vi.hoisted(() =>
  vi.fn(async () => {
    if (state.logoutFails) {
      throw new Error("revocation unavailable");
    }
  }),
);

vi.mock("../../../../lib/services/auth-service", () => ({
  authService: {
    getSession,
    logout,
  },
}));

import { DELETE, GET } from "./route";

function request(method = "GET") {
  return new NextRequest("https://nexus.test/api/auth/session", {
    method,
    headers: {
      origin: "https://nexus.test",
      cookie: "nexus_session=session-token",
    },
  });
}

function expectPrivateCorrelation(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{20,}$/u);
}

describe("current auth session HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = {
      id: "usr_session",
      username: "session-user",
    };
    state.readFails = false;
    state.logoutFails = false;
  });

  it("returns authenticated state with private request correlation", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expectPrivateCorrelation(response);
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      user: state.user,
    });
  });

  it("distinguishes signed-out state from a session-read failure", async () => {
    state.user = null;
    const signedOut = await GET(request());
    expect(signedOut.status).toBe(200);
    expectPrivateCorrelation(signedOut);
    await expect(signedOut.json()).resolves.toEqual({
      authenticated: false,
      user: null,
    });

    state.readFails = true;
    const failed = await GET(request());
    expect(failed.status).toBe(503);
    expectPrivateCorrelation(failed);
    await expect(failed.json()).resolves.toEqual({
      error: "Could not check session",
    });
  });

  it("clears the cookie only after confirmed logout", async () => {
    const response = await DELETE(request("DELETE"));
    expect(response.status).toBe(200);
    expectPrivateCorrelation(response);
    expect(response.headers.get("set-cookie")).toContain("nexus_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(logout).toHaveBeenCalledWith("session-token");

    state.logoutFails = true;
    const failed = await DELETE(request("DELETE"));
    expect(failed.status).toBe(503);
    expectPrivateCorrelation(failed);
    expect(failed.headers.get("set-cookie")).toBeNull();
  });
});
