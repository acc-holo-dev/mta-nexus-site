import { createHash, randomBytes } from "node:crypto";
import { LICENSE_RUNTIME_TOKEN_PATTERN } from "@nexus/domain";

/** Only the digest is persisted. The bearer value is returned once to its owner. */
export function createLicenseRuntimeToken(): { value: string; digest: string } {
  const value = `nxlt_${randomBytes(32).toString("base64url")}`;
  const digest = digestLicenseRuntimeToken(value);
  if (!digest) throw new Error("Generated an invalid license token");
  return { value, digest };
}

export function digestLicenseRuntimeToken(value: string): string | null {
  if (!LICENSE_RUNTIME_TOKEN_PATTERN.test(value)) return null;
  return createHash("sha256").update(`nexus:license-runtime:v1\0${value}`).digest("hex");
}
