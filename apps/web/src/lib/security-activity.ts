export const SECURITY_ACTIVITY_ACTIONS = [
  "user.registered",
  "user.logged_in",
  "user.logged_out",
  "user.password_changed",
  "user.password_reset",
  "auth.recovery_email_verified",
  "user.context_switched",
  "user.session_revoked",
  "user.other_sessions_revoked",
] as const;

export type SecurityActivityAction =
  (typeof SECURITY_ACTIVITY_ACTIONS)[number];

export const SECURITY_ACTIVITY_LABEL_KEYS = {
  "user.registered": "registered",
  "user.logged_in": "loggedIn",
  "user.logged_out": "loggedOut",
  "user.password_changed": "passwordChanged",
  "user.password_reset": "passwordReset",
  "auth.recovery_email_verified": "recoveryVerified",
  "user.context_switched": "contextSwitched",
  "user.session_revoked": "sessionRevoked",
  "user.other_sessions_revoked": "otherSessionsRevoked",
} as const satisfies Record<SecurityActivityAction, string>;

const SECURITY_ACTIVITY_SET = new Set<string>(SECURITY_ACTIVITY_ACTIONS);

export function isSecurityActivityAction(
  action: string,
): action is SecurityActivityAction {
  return SECURITY_ACTIVITY_SET.has(action);
}

export interface SecurityActivityItem {
  id: string;
  action: SecurityActivityAction;
  targetType: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export function toSecurityActivityItem(event: {
  id: string;
  action: string;
  targetType: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}): SecurityActivityItem | null {
  if (!isSecurityActivityAction(event.action)) return null;
  return {
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    ipAddress: event.ipAddress,
    userAgent: event.userAgent,
    createdAt: event.createdAt,
  };
}
