/**
 * Resolve game-server hosts using the same browser/Node WHATWG URL parser.
 * The game port is always stored separately from the canonical host.
 */
function canonicalMtaHost(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  // A single terminal DNS dot is allowed; repeated dots are malformed.
  if (trimmed.endsWith("..")) return null;
  const endsInDnsDot = trimmed.endsWith(".");
  const value = trimmed.replace(/\.$/u, "");
  if (value.length === 0 || value.length > 255 || !/^[\p{L}\p{N}.:\[\]-]+$/u.test(value)) {
    return null;
  }

  if (value.includes(":") || value.includes("[") || value.includes("]")) {
    // A terminal dot is valid for a DNS name, not an IPv6 literal.
    if (endsInDnsDot) return null;
    const bracketed =
      value.startsWith("[") && value.endsWith("]")
        ? value
        : value.includes("[") || value.includes("]")
          ? null
          : "[" + value + "]";
    if (!bracketed) return null;
    try {
      // URL verifies the entire IPv6 literal and compresses equivalent forms.
      const url = new URL("http://" + bracketed + "/");
      return url.port === "" && /^\[[0-9a-f:.]+\]$/u.test(url.hostname) ? url.hostname : null;
    } catch {
      return null;
    }
  }

  try {
    // IDN labels become stable ASCII punycode; IPv4 shorthand is expanded.
    const host = new URL("http://" + value + "/").hostname.replace(/\.$/u, "");
    if (host.length === 0 || host.length > 253) return null;
    const labels = host.split(".");
    if (
      labels.some(
        (label) => label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label),
      )
    ) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

export function normalizeMtaAddress(address: string): string {
  // Preserve invalid text for the validator to reject; never turn a malformed
  // double-dot host into a valid one by stripping just its final dot.
  return canonicalMtaHost(address) ?? address.trim().toLowerCase();
}

export function isValidMtaAddress(address: string): boolean {
  return canonicalMtaHost(address) !== null;
}
