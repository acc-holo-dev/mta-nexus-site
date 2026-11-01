import { readFileSync } from "node:fs";
import {
  CRITICAL_STAFF_ADMIN_ACTIONS,
  FRESH_AUTH_ACTIONS,
  criticalStaffAdminFreshAuthAction,
  freshAuthProofAccepted,
  freshAuthRequirement,
  ordinaryRecoveryEligible,
  staffActionRequiresPasswordHashRecheck,
} from "@nexus/security";
import { describe, expect, it } from "vitest";

const account = {
  role: "user",
  twoFactorEnabled: false,
  hasPassword: true,
};

describe("fresh-auth requirements", () => {
  it("rejects a live session for staff actions, withdrawals, recovery, and security changes", () => {
    expect(FRESH_AUTH_ACTIONS).toEqual([
      "staff_action",
      "withdrawal",
      "account_recovery",
      "security_change",
      "organization_ownership",
    ]);
    for (const action of FRESH_AUTH_ACTIONS) {
      const requirement = freshAuthRequirement(action);
      expect(requirement.sessionSatisfies).toBe(false);
      expect(requirement.recheckInsideTransaction).toBe(true);
      expect(freshAuthProofAccepted(action, "session")).toBe(false);
      expect(freshAuthProofAccepted(action, "current_password")).toBe(true);
    }
  });

  it("accepts a recovery challenge only for account recovery", () => {
    expect(freshAuthProofAccepted("account_recovery", "recovery_challenge")).toBe(true);
    expect(freshAuthProofAccepted("staff_action", "recovery_challenge")).toBe(false);
    expect(freshAuthProofAccepted("withdrawal", "recovery_challenge")).toBe(false);
    expect(freshAuthProofAccepted("security_change", "recovery_challenge")).toBe(false);
    expect(freshAuthProofAccepted("organization_ownership", "recovery_challenge")).toBe(false);
  });

  it("keeps ordinary recovery off staff, moderator, 2FA, and passwordless accounts", () => {
    expect(ordinaryRecoveryEligible(account)).toBe(true);
    expect(ordinaryRecoveryEligible({ ...account, role: "developer" })).toBe(true);
    expect(ordinaryRecoveryEligible({ ...account, role: "server_owner" })).toBe(true);
    for (const role of ["admin", "moderator"]) {
      expect(ordinaryRecoveryEligible({ ...account, role })).toBe(false);
    }
    expect(ordinaryRecoveryEligible({ ...account, twoFactorEnabled: true })).toBe(false);
    expect(ordinaryRecoveryEligible({ ...account, hasPassword: false })).toBe(false);
  });

  it("uses that rule at every ordinary recovery gate", () => {
    for (const path of [
      "packages/db/src/repositories/account-challenges.ts",
      "packages/db/src/repositories/account-email-enrollment.ts",
      "packages/db/src/repositories/account-mail-worker.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      expect(source).toContain("ordinaryRecoveryEligible");
      expect(source).not.toContain('["admin", "moderator"]');
    }
  });

  it("binds every existing admin/actions command to staff_action → current_password", () => {
    expect(CRITICAL_STAFF_ADMIN_ACTIONS).toEqual([
      { targetType: "product", action: "feature" },
      { targetType: "product", action: "unfeature" },
      { targetType: "product", action: "suspend" },
      { targetType: "product", action: "restore" },
      { targetType: "report", action: "resolve" },
      { targetType: "report", action: "dismiss" },
      { targetType: "verification", action: "approve" },
      { targetType: "verification", action: "reject" },
      { targetType: "build", action: "approve" },
      { targetType: "build", action: "reject" },
      { targetType: "build", action: "quarantine" },
      { targetType: "build", action: "restore" },
      { targetType: "content", action: "publish" },
      { targetType: "content", action: "archive" },
    ]);
    for (const row of CRITICAL_STAFF_ADMIN_ACTIONS) {
      expect(criticalStaffAdminFreshAuthAction(row.targetType, row.action)).toBe("staff_action");
      expect(freshAuthProofAccepted("staff_action", "session")).toBe(false);
      expect(freshAuthProofAccepted("staff_action", "current_password")).toBe(true);
    }
    expect(criticalStaffAdminFreshAuthAction("product", "delete")).toBeNull();
    expect(staffActionRequiresPasswordHashRecheck("build", "approve")).toBe(true);
    expect(staffActionRequiresPasswordHashRecheck("build", "reject")).toBe(true);
    expect(staffActionRequiresPasswordHashRecheck("build", "quarantine")).toBe(false);
    expect(staffActionRequiresPasswordHashRecheck("report", "resolve")).toBe(false);
  });

  it("keeps admin/actions HTTP enforcement on the staff_action proof path", () => {
    const route = readFileSync("apps/web/src/app/api/admin/actions/route.ts", "utf8");
    expect(route).toContain("criticalStaffAdminFreshAuthAction");
    expect(route).toContain("confirmStaffActionPassword");
    expect(route).toContain("currentPassword");
    expect(route).not.toMatch(/details:.*currentPassword/);
    expect(route).not.toMatch(/logRequestEvent\([\s\S]*currentPassword/);
  });
});
