import { lookup as dnsLookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export type WebPushResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type WebPushHostResolver = (
  hostname: string,
) => Promise<WebPushResolvedAddress[]>;

const RESERVED_ADDRESSES = new BlockList();

for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  RESERVED_ADDRESSES.addSubnet(address, prefix, "ipv4");
}

for (const [address, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:2::", 48],
  ["2001:10::", 28],
  ["2001:20::", 28],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  RESERVED_ADDRESSES.addSubnet(address, prefix, "ipv6");
}

function normalizedHostname(url: URL): string {
  return url.hostname
    .replace(/^\[/u, "")
    .replace(/\]$/u, "")
    .replace(/\.$/u, "")
    .toLowerCase();
}

export function parseWebPushEndpoint(value: string): URL {
  const endpoint = value.trim();
  if (!endpoint || endpoint.length > 2048) {
    throw new Error("Invalid Web Push endpoint");
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("Invalid Web Push endpoint");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("Unsafe Web Push endpoint");
  }

  const hostname = normalizedHostname(url);
  if (
    !hostname ||
    hostname.length > 253 ||
    !hostname.includes(".") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isIP(hostname) !== 0
  ) {
    throw new Error("Unsafe Web Push endpoint");
  }

  return url;
}

export function isPublicWebPushAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return false;

  if (family === 6 && address.toLowerCase().startsWith("::ffff:")) {
    return false;
  }

  return !RESERVED_ADDRESSES.check(
    address,
    family === 4 ? "ipv4" : "ipv6",
  );
}

export const systemWebPushHostResolver: WebPushHostResolver = async (
  hostname,
) => {
  const records = await dnsLookup(hostname, {
    all: true,
    verbatim: true,
  });
  return records
    .filter(
      (record): record is { address: string; family: 4 | 6 } =>
        record.family === 4 || record.family === 6,
    )
    .map((record) => ({
      address: record.address,
      family: record.family,
    }));
};

export async function resolveWebPushTarget(
  endpoint: string,
  resolver: WebPushHostResolver = systemWebPushHostResolver,
): Promise<{
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
}> {
  const url = parseWebPushEndpoint(endpoint);
  const hostname = normalizedHostname(url);
  const records = await resolver(hostname);

  if (!records.length || records.some((record) => !isPublicWebPushAddress(record.address))) {
    throw new Error("Web Push endpoint did not resolve exclusively to public addresses");
  }

  const [selected] = records;
  if (!selected) {
    throw new Error("Web Push endpoint resolution failed");
  }

  return {
    url,
    hostname,
    address: selected.address,
    family: selected.family,
  };
}
