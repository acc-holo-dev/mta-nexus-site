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
export { parseSessionResponse } from "./session/shell-session-payload";
export {
  requestShellSessionRefresh,
  SHELL_SESSION_REFRESH_EVENT,
} from "./session/shell-session-refresh";
