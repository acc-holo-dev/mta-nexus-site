"use client";

export type { ShellAuthSession } from "./session/shell-destination-policy";
export {
  adminDestinationAccessibleName,
  isShellSessionLoading,
  isStaffRole,
  shellDestinationActive,
  showAdminDestination,
  showGuestSignInCta,
  showWorkspaceTools,
} from "./session/shell-destination-policy";
export { parseSessionResponse, parseShellSession } from "./session/shell-session-payload";
export {
  SHELL_SESSION_REFRESH_EVENT,
  requestShellSessionRefresh,
} from "./session/shell-session-refresh";