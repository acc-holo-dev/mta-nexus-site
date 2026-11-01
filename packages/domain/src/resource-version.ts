/**
 * OPS-19: human resource release versions for new uploads.
 *
 * Canonical form: SemVer-like `MAJOR.MINOR.PATCH[-pre]` (PATCH optional for
 * legacy-compatible acceptance; compare treats a missing PATCH as 0).
 * Optional leading `v` is stripped for compare and uniqueness of new releases.
 *
 * Keep these identities separate — never overload the human version string:
 * - build id / storage identity
 * - artifact SHA-256 / bytes
 * - display app/product version string (this field after normalize)
 * - `mtaVersionTarget` (MTA client/server compatibility)
 * - package evidence `schemaVersion` (wire format, currently 1)
 *
 * Published historical version strings and bytes are not rewritten.
 */

export const RESOURCE_VERSION_PATTERN =
  /^v?[0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[a-zA-Z0-9.]+)?$/;

export type ParsedResourceVersion = {
  /** Version without optional leading `v`; used for storage/uniqueness of new releases. */
  identity: string;
  major: bigint;
  minor: bigint;
  patch: bigint;
  /** Pre-release identifiers after `-`, or null for a release version. */
  prerelease: string[] | null;
};

/** True when the string matches the accepted SemVer-like resource version pattern. */
export function isValidResourceVersion(value: string): boolean {
  return typeof value === "string" && RESOURCE_VERSION_PATTERN.test(value);
}

/** Strip a single optional leading `v` without rewriting other characters. */
export function stripResourceVersionPrefix(value: string): string {
  return value.startsWith("v") ? value.slice(1) : value;
}

/**
 * Canonical storage form for NEW releases: optional leading `v` removed.
 * Invalid input is returned unchanged so callers can still surface validation errors.
 * Does not rewrite already-published historical rows.
 */
export function normalizeResourceVersionForStorage(value: string): string {
  if (!isValidResourceVersion(value)) return value;
  return stripResourceVersionPrefix(value);
}

/** Uniqueness key for product builds: same identity ⇒ must not create another build. */
export function resourceVersionIdentityKey(value: string): string | null {
  if (!isValidResourceVersion(value)) return null;
  return stripResourceVersionPrefix(value);
}

/** Duplicate version identity (after optional `v` strip), including across `v1.2.3` / `1.2.3`. */
export function resourceVersionsConflict(left: string, right: string): boolean {
  const a = resourceVersionIdentityKey(left);
  const b = resourceVersionIdentityKey(right);
  return a !== null && b !== null && a === b;
}

export function parseResourceVersion(value: string): ParsedResourceVersion | null {
  if (!isValidResourceVersion(value)) return null;
  const identity = stripResourceVersionPrefix(value);
  const match = /^([0-9]+)\.([0-9]+)(?:\.([0-9]+))?(?:-([a-zA-Z0-9.]+))?$/.exec(identity);
  if (!match) return null;
  return {
    identity,
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3] ?? "0"),
    prerelease: match[4] ? match[4].split(".") : null,
  };
}

function comparePreReleaseIdentifiers(left: string, right: string): number {
  const leftNumeric = /^[0-9]+$/.test(left);
  const rightNumeric = /^[0-9]+$/.test(right);
  if (leftNumeric && rightNumeric) {
    const a = BigInt(left);
    const b = BigInt(right);
    if (a === b) return 0;
    return a > b ? 1 : -1;
  }
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

/**
 * SemVer precedence after optional `v` strip. Missing PATCH compares as 0.
 * Returns null when either side is not a valid resource version.
 * `null` never sorts as equal to a valid version.
 */
export function compareResourceVersions(left: string, right: string): -1 | 0 | 1 | null {
  const a = parseResourceVersion(left);
  const b = parseResourceVersion(right);
  if (!a || !b) return null;

  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;

  if (a.prerelease === null && b.prerelease === null) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = a.prerelease[index];
    const rightPart = b.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const order = comparePreReleaseIdentifiers(leftPart, rightPart);
    if (order !== 0) return order;
  }
  return 0;
}
