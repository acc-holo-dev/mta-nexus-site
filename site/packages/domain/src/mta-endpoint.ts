/**
 * Resolve game-server hosts using the same browser/Node WHATWG URL parser.
 * The game port is always stored separately from the canonical host.
 */
function dottedIpv4FromMapped(hostname: string): string | null {
  // WHATWG serializes ::ffff:0:0/96 as [::ffff:hhhh:hhhh]. That prefix is the
  // same 32-bit address as dotted IPv4, so both spellings must share one server.
  const mapped = /^\[::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]$/u.exec(hostname);
  if (!mapped) return null;
  const high = Number.parseInt(mapped[1], 16);
  const low = Number.parseInt(mapped[2], 16);
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function canonicalMtaHost(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  // A single terminal DNS dot is allowed; repeated dots are malformed.
  if (trimmed.endsWith("..")) return null;
  const endsInDnsDot = trimmed.endsWith(".");
  const value = trimmed.replace(/\.$/u, "");
  if (value.length === 0 || value.length > 255 || !/^[\p{L}\p{N}.:[\]-]+$/u.test(value)) {
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
          : `[${value}]`;
    if (!bracketed) return null;
    try {
      // URL verifies the entire IPv6 literal and compresses equivalent forms.
      const url = new URL(`http://${bracketed}/`);
      const hostname = url.hostname;
      if (url.port !== "" || !/^\[[0-9a-f:.]+\]$/u.test(hostname)) return null;
      return dottedIpv4FromMapped(hostname) ?? hostname;
    } catch {
      return null;
    }
  }

  try {
    // IDN labels become stable ASCII punycode; IPv4 shorthand is expanded.
    const host = new URL(`http://${value}/`).hostname.replace(/\.$/u, "");
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
