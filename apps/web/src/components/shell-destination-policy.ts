/**
 * UX-23 A — guest / capability shell presentation.
 *
 * - Guest / unknown / loading: primary public nav only; hide entire Workspace
 *   cluster and Admin. Sign-in CTA is chrome (not a Workspace group of tools).
 * - Authenticated member: Workspace grouped by objects/capabilities.
 * - Admin only when staff capability (admin / moderator).
 *
 * Server authz remains mandatory; visible links do not grant rights.
 * No role-picker UI.
 */

export type ShellAuthSession =
  | { status: "loading"; user: null }
  | { status: "anonymous"; user: null }
  | {
      status: "authenticated";
      user: { username: string; role: string | null };
    };

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "moderator";
}

export function showAdminDestination(session: ShellAuthSession): boolean {
  return session.status === "authenticated" && isStaffRole(session.user.role);
}

export function showWorkspaceTools(session: ShellAuthSession): boolean {
  return session.status === "authenticated";
}

/** Chrome Sign in for confirmed guests — not shown while session is still loading. */
export function showGuestSignInCta(session: ShellAuthSession): boolean {
  return session.status === "anonymous";
}

/** Session probe in flight — hide Workspace and Sign in until resolved (fail closed). */
export function isShellSessionLoading(session: ShellAuthSession): boolean {
  return session.status === "loading";
}

export function adminDestinationAccessibleName(adminLabel: string, staffHint: string): string {
  return `${adminLabel} (${staffHint})`;
}
