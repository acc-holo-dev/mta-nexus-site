/** Cookie preference: hide personal changes module on Home (UX-14 A opt-out). */
export const HOME_PERSONAL_COOKIE = "nexus_home_personal";
export const HOME_PERSONAL_HIDE = "hide";
export const HOME_PERSONAL_SHOW = "show";

export type HomePersonalPreference = "show" | "hide";

export function parseHomePersonalPreference(
  value: string | null | undefined,
): HomePersonalPreference {
  return value === HOME_PERSONAL_HIDE ? "hide" : "show";
}

export function homePersonalPreferenceCookie(value: HomePersonalPreference): string {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  return `${HOME_PERSONAL_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}
