import { MTA_VERSION_PATTERN } from "@nexus/validation";

export type MinimumMtaVersions = Readonly<{
  client: string | null;
  server: string | null;
  both: string | null;
}>;

/** Return a single declared minimum only when it applies to the whole resource. */
export function getMtaVersionTargetSuggestion(
  minimum: MinimumMtaVersions | null,
): string | null {
  if (!minimum) return null;

  if (minimum.both) {
    return MTA_VERSION_PATTERN.test(minimum.both) ? minimum.both : null;
  }

  const { client, server } = minimum;
  if (client && server && client !== server) return null;

  const candidate = server ?? client;
  return candidate && MTA_VERSION_PATTERN.test(candidate) ? candidate : null;
}
