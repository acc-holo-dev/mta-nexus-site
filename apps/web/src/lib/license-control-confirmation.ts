import {
  LICENSE_RUNTIME_TOKEN_PATTERN,
  LICENSE_RUNTIME_TOKEN_DAYS,
  type LicenseControlConfirmation,
} from "@nexus/domain";

export function confirmedLicenseControl(
  body: unknown,
  id: string,
  revision: string,
  action: string,
  expectedEndpointRevision?: number | null,
  licenseExpiresAt?: string | null,
): body is LicenseControlConfirmation {
  if (
    ![
      "bind",
      "refresh_binding",
      "rotate_token",
      "revoke_token",
      "revoke",
      "suspend",
      "restore",
    ].includes(action)
  )
    return false;
  if (!body || typeof body !== "object") return false;
  const result = body as Partial<LicenseControlConfirmation>;
  const license = result.license;
  if (
    !license ||
    license.id !== id ||
    typeof license.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(license.updatedAt)) ||
    new Date(license.updatedAt).toISOString() !== license.updatedAt ||
    Date.parse(license.updatedAt) <= Date.parse(revision) ||
    typeof license.serverBound !== "boolean"
  )
    return false;
  const expected =
    action === "suspend"
      ? "suspended"
      : action === "revoke"
        ? "revoked"
        : action === "restore"
          ? "active"
          : undefined;
  if (expected && license.status !== expected) return false;
  if (!expected && !["active", "expired", "revoked", "suspended"].includes(license.status))
    return false;
  if (
    (action === "bind" || action === "refresh_binding") &&
    (license.status !== "active" || !license.serverBound)
  )
    return false;
  if (action === "refresh_binding")
    return (
      !result.token &&
      result.binding?.tokenRevoked === true &&
      Number.isSafeInteger(expectedEndpointRevision) &&
      expectedEndpointRevision !== null &&
      result.binding.endpointRevision === expectedEndpointRevision
    );
  if (action === "rotate_token")
    return (
      license.status === "active" &&
      license.serverBound &&
      !!result.token &&
      typeof result.token.value === "string" &&
      LICENSE_RUNTIME_TOKEN_PATTERN.test(result.token.value) &&
      typeof result.token.expiresAt === "string" &&
      Number.isFinite(Date.parse(result.token.expiresAt)) &&
      Date.parse(result.token.expiresAt) > Date.now() &&
      Date.parse(result.token.expiresAt) <=
        Date.parse(license.updatedAt) + LICENSE_RUNTIME_TOKEN_DAYS * 86_400_000 &&
      (!licenseExpiresAt || Date.parse(result.token.expiresAt) <= Date.parse(licenseExpiresAt))
    );
  return !result.token;
}
