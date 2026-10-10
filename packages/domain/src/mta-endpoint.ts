/**
 * Match the canonical representation used by the official MTA directory.
 * The game port is stored separately and must never be embedded in this value.
 */
export function normalizeMtaAddress(address: string): string {
  return address.trim().toLowerCase().replace(/\.$/u, "");
}

/** Reject malformed addresses while retaining valid IPv4, DNS and IPv6 literals. */
export function isValidMtaAddress(address: string): boolean {
  return (
    address.length > 0 &&
    address.length <= 255 &&
    address !== "." &&
    !address.startsWith(".") &&
    !address.endsWith(".") &&
    !address.includes("..") &&
    // Ports are separate: reject host:port without rejecting IPv6 literals.
    (address.match(/:/gu)?.length ?? 0) !== 1 &&
    !/[\s/\\?#@\u0000-\u001f\u007f]/u.test(address)
  );
}
