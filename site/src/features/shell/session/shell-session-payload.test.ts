import { describe, expect, it } from "vitest";
import { parseShellSession } from "./shell-session-payload";

describe("shell session response", () => {
  it("accepts only an explicit anonymous response as signed out", () => {
    expect(parseShellSession({ authenticated: false, user: null })).toEqual({
      status: "anonymous",
      user: null,
    });
    for (const payload of [
      null,
      {},
      { authenticated: false },
      { authenticated: false, user: {} },
      { authenticated: "false", user: null },
    ]) {
      expect(parseShellSession(payload)).toBeNull();
    }
  });
  it("requires a valid authenticated identity and never invents a staff role", () => {
    expect(
      parseShellSession({
        authenticated: true,
        user: { id: "usr_1", username: "member", role: "moderator" },
      }),
    ).toEqual({ status: "authenticated", user: { username: "member", role: "moderator" } });
    expect(
      parseShellSession({ authenticated: true, user: { id: "usr_1", username: "member" } }),
    ).toEqual({ status: "authenticated", user: { username: "member", role: null } });
    for (const user of [
      null,
      {},
      { id: "", username: "member" },
      { id: "bad ", username: "member" },
      { id: "usr_1", username: " " },
    ]) {
      expect(parseShellSession({ authenticated: true, user })).toBeNull();
    }
  });
});
