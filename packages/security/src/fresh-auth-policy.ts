export const FRESH_AUTH_ACTIONS = [
  "staff_action",
  "withdrawal",
  "account_recovery",
  "security_change",
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

// Shared by recovery status, challenge locks, and mail delivery. Staff and
// 2FA accounts stay outside this proof until a separate fresh-auth path exists.
export function ordinaryRecoveryEligible(account: {
  role: string;
  twoFactorEnabled: boolean;
  hasPassword: boolean;
}): boolean {
  const recovery = freshAuthRequirement("account_recovery");
  if (
    recovery.sessionSatisfies
    || !recovery.recheckInsideTransaction
    || !recovery.acceptedProofs.includes("current_password")
    || !recovery.acceptedProofs.includes("recovery_challenge")
  ) return false;
  if (!account.hasPassword || account.twoFactorEnabled) return false;
  return account.role !== "admin" && account.role !== "moderator";
}
