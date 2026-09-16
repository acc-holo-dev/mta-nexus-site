import crypto from "node:crypto";

export type EntityPrefix =
  | "usr"
  | "org"
  | "mem"
  | "dev"
  | "srv"
  | "ins"
  | "prd"
  | "bld"
  | "ast"
  | "lic"
  | "ent"
  | "ord"
  | "ite"
  | "pay"
  | "ldg"
  | "cnt"
  | "cmt"
  | "rec"
  | "fol"
  | "not"
  | "aud"
  | "rpt"
  | "mod"
  | "ses"
  | "evt"
  | "ver";

/**
 * Generates secure, collision-resistant, URL-safe opaque IDs with entity prefix
 * Example: usr_7f8c92a10b45e69d
 */
export function generateId(prefix: EntityPrefix): string {
  const bytes = crypto.randomBytes(12);
  const randomHex = bytes.toString("hex");
  return `${prefix}_${randomHex}`;
}
