/** Ask every shell account view to recheck without assuming an identity. */
export const SHELL_SESSION_REFRESH_EVENT = "nexus:shell-session-refresh";

export function requestShellSessionRefresh() {
  window.dispatchEvent(new Event(SHELL_SESSION_REFRESH_EVENT));
}
