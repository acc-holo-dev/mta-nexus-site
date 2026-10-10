export const SERVER_ACTIVITY_ACTIONS = [
  "server.created",
  "server.updated",
  "server.claim_challenge_issued",
] as const;

export type ServerActivityAction = (typeof SERVER_ACTIVITY_ACTIONS)[number];

// Only field names are exposed, never old/new values or arbitrary audit details.
export const SERVER_ACTIVITY_FIELDS = [
  "name",
  "description",
  "websiteUrl",
  "discordUrl",
  "rulesUrl",
  "mediaUrls",
  "language",
  "region",
  "gameplayTags",
  "ipAddress",
  "port",
  "httpPort",
  "gameMode",
  "mapName",
  "maxPlayers",
  "visibility",
] as const;

export type ServerActivityField = (typeof SERVER_ACTIVITY_FIELDS)[number];

export function serverActivityCursor(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : undefined;
}
