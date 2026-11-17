export const SESSION_COOKIE_NAME = "nexus_session";

/** Keep issuance, rotation and deletion on the same host-only cookie scope. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}
