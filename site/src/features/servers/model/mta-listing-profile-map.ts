import { normalizeMtaAddress } from "@nexus/domain";

/** Endpoint key for matching editorial listings to live MTA observations. */
export function mtaEndpointKey(address: string, port: number): string {
  return `${normalizeMtaAddress(address)}:${port}`;
}

/** Build a serializable address:port → public listing slug map for directory cards. */
export function mtaListingProfileRecord(
  listings: readonly { ipAddress: string; port: number; slug: string }[],
): Record<string, string> {
  const profiles: Record<string, string> = {};
  for (const listing of listings) {
    profiles[mtaEndpointKey(listing.ipAddress, listing.port)] = listing.slug;
  }
  return profiles;
}
