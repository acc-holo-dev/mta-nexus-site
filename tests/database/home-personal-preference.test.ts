import { describe, expect, it } from "vitest";
import {
  showAdminDestination,
  showGuestSignInCta,
  showWorkspaceTools,
} from "../../site/src/components/shell-destination-policy";
import { parseHomePersonalPreference } from "../../site/src/lib/home-personal-preference";

describe("home personal preference", () => {
  it("defaults to show and only hides on the explicit cookie value", () => {
    expect(parseHomePersonalPreference(undefined)).toBe("show");
    expect(parseHomePersonalPreference(null)).toBe("show");
    expect(parseHomePersonalPreference("show")).toBe("show");
    expect(parseHomePersonalPreference("hide")).toBe("hide");
    expect(parseHomePersonalPreference("nope")).toBe("show");
  });
});

describe("UX-23 A shell destination helpers", () => {
  it("hides Workspace and Admin for guests while keeping Sign in chrome", () => {
    expect(showWorkspaceTools({ status: "anonymous", user: null })).toBe(false);
    expect(showAdminDestination({ status: "anonymous", user: null })).toBe(false);
    expect(showGuestSignInCta({ status: "anonymous", user: null })).toBe(true);
    expect(showGuestSignInCta({ status: "loading", user: null })).toBe(false);
    expect(
      showGuestSignInCta({ status: "authenticated", user: { username: "a", role: "user" } }),
    ).toBe(false);
  });
});
