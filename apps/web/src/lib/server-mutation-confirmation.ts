type ServerMutationBody = Readonly<{
  server?: unknown;
}>;

function serverObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const server = (body as ServerMutationBody).server;
  return server && typeof server === "object" && !Array.isArray(server)
    ? (server as Record<string, unknown>)
    : null;
}

export function confirmedCreatedServer(
  status: number,
  body: unknown,
  expectedSlug: string,
  expectedOrganizationId?: string | null,
): string | null {
  if (status !== 201 || !expectedSlug) return null;
  const server = serverObject(body);
  if (
    !server ||
    typeof server.id !== "string" ||
    !server.id ||
    server.slug !== expectedSlug
  ) {
    return null;
  }

  // A response for the right slug but wrong account must never redirect the
  // person to a server listing they cannot manage.
  if (expectedOrganizationId === null && server.organizationId != null) {
    return null;
  }
  if (
    typeof expectedOrganizationId === "string" &&
    server.organizationId !== expectedOrganizationId
  ) {
    return null;
  }
  return server.id;
}

export type ExpectedServerUpdate = Readonly<{
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  visibility: string;
  httpPort?: number;
  mapName?: string;
  description?: string;
  websiteUrl?: string;
  discordUrl?: string;
  rulesUrl?: string;
  mediaUrls?: readonly string[];
  language?: string;
  region?: string;
  gameplayTags?: readonly string[];
  gameMode?: string;
  maxPlayers?: number;
  expectedUpdatedAt?: string;
}>;

function matchingField(actual: unknown, expected: unknown): boolean {
  if (expected === undefined) return true;
  if (Array.isArray(expected)) {
    return Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((value, index) => actual[index] === value);
  }
  return actual === expected;
}

export function confirmedUpdatedServer(
  status: number,
  body: unknown,
  expected: ExpectedServerUpdate,
): boolean {
  if (status !== 200) return false;
  const server = serverObject(body);
  if (!server) return false;

  const { expectedUpdatedAt, ...fields } = expected;
  if (!Object.entries(fields).every(
    ([key, value]) => matchingField(server[key], value),
  )) {
    return false;
  }

  if (expectedUpdatedAt !== undefined) {
    const oldRevision = Date.parse(expectedUpdatedAt);
    const newRevision = typeof server.updatedAt === "string"
      ? Date.parse(server.updatedAt)
      : Number.NaN;
    // A successful write must return a later authoritative revision.
    if (
      !Number.isFinite(oldRevision) ||
      !Number.isFinite(newRevision) ||
      newRevision <= oldRevision
    ) {
      return false;
    }
  }
  return true;
}
