export const FRESH_AUTH_ACTIONS = [
  "staff_action",
  "withdrawal",
  "account_recovery",
  "security_change",
  "organization_ownership",
] as const;

export type FreshAuthAction = (typeof FRESH_AUTH_ACTIONS)[number];

// A recovery challenge proves control of a verified mailbox. It is not a
// staff, withdrawal, or password-change proof. A live session is never enough.
export type FreshAuthProof = "current_password" | "recovery_challenge";

export interface FreshAuthRequirement {
  readonly action: FreshAuthAction;
  readonly sessionSatisfies: boolean;
  readonly recheckInsideTransaction: boolean;
  readonly acceptedProofs: readonly FreshAuthProof[];
}

const REQUIREMENTS: Record<FreshAuthAction, FreshAuthRequirement> = {
  staff_action: requirement("staff_action", ["current_password"]),
  withdrawal: requirement("withdrawal", ["current_password"]),
  account_recovery: requirement("account_recovery", ["current_password", "recovery_challenge"]),
  security_change: requirement("security_change", ["current_password"]),
  organization_ownership: requirement("organization_ownership", ["current_password"]),
};

function requirement(
  action: FreshAuthAction,
  acceptedProofs: readonly FreshAuthProof[],
): FreshAuthRequirement {
  return Object.freeze({
    action,
    sessionSatisfies: false,
    recheckInsideTransaction: true,
    acceptedProofs: Object.freeze([...acceptedProofs]),
  });
}

export function freshAuthRequirement(action: FreshAuthAction): FreshAuthRequirement {
  return REQUIREMENTS[action];
}

export function freshAuthProofAccepted(
  action: FreshAuthAction,
  proof: FreshAuthProof | "session",
): boolean {
  const rule = freshAuthRequirement(action);
  if (proof === "session") return rule.sessionSatisfies;
  return rule.acceptedProofs.includes(proof);
}

/**
 * Existing `/api/admin/actions` commands that inherit `staff_action` →
 * `current_password`. Session/role alone never satisfies these.
 */
export const CRITICAL_STAFF_ADMIN_ACTIONS = [
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
] as const;

export type CriticalStaffAdminAction = (typeof CRITICAL_STAFF_ADMIN_ACTIONS)[number];

export function criticalStaffAdminFreshAuthAction(
  targetType: string,
  action: string,
): FreshAuthAction | null {
  for (const row of CRITICAL_STAFF_ADMIN_ACTIONS) {
    if (row.targetType === targetType && row.action === action) return "staff_action";
  }
  return null;
}

/** Build review is the admin/actions path that rechecks the password hash in-txn. */
export function staffActionRequiresPasswordHashRecheck(
  targetType: string,
  action: string,
): boolean {
  return (
    criticalStaffAdminFreshAuthAction(targetType, action) === "staff_action" &&
    targetType === "build" &&
    (action === "approve" || action === "reject")
  );
}

// Shared by recovery status, challenge locks, and mail delivery. Staff and
// 2FA accounts stay outside this proof until a separate fresh-auth path exists.
export function ordinaryRecoveryEligible(account: {
  role: string;
  twoFactorEnabled: boolean;
  hasPassword: boolean;
}): boolean {
  const recovery = freshAuthRequirement("account_recovery");
  if (
    recovery.sessionSatisfies ||
    !recovery.recheckInsideTransaction ||
    !recovery.acceptedProofs.includes("current_password") ||
    !recovery.acceptedProofs.includes("recovery_challenge")
  )
    return false;
  if (!account.hasPassword || account.twoFactorEnabled) return false;
  return account.role !== "admin" && account.role !== "moderator";
}
