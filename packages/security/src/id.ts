import crypto from "node:crypto";

export type EntityPrefix =
  | "rea"
  | "usr"
  | "org"
  | "mem"
  | "dev"
  | "srv"
  | "obs"
  | "ins"
  | "prd"
  | "vgrp"
  | "cplan"
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
  | "ver"
  | "sup"
  | "spm"
  | "wps";

/**
 * Generates secure, collision-resistant, URL-safe opaque IDs with entity prefix.
 */
export function generateId(prefix: EntityPrefix): string {
  const bytes = crypto.randomBytes(12);
  const randomHex = bytes.toString("hex");
  return `${prefix}_${randomHex}`;
}

/**
 * Generates a high-entropy bearer token. Only its digest should be persisted.
 */
export function generateSessionToken(): string {
  return `ses_${crypto.randomBytes(32).toString("base64url")}`;
}
