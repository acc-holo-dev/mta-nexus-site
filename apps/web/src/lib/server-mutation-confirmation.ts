type ServerMutationBody = Readonly<{
  server?: unknown;
}>;

function serverObject(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const server = (body as ServerMutationBody).server;
  return server && typeof server === "object"
    ? (server as Record<string, unknown>)
    : null;
}

export function confirmedCreatedServer(
  status: number,
  body: unknown,
  expectedSlug: string,
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
  return server.id;
}

export function confirmedUpdatedServer(
  status: number,
  body: unknown,
  expected: Readonly<{
    id: string;
    name: string;
    ipAddress: string;
    port: number;
    visibility: string;
  }>,
): boolean {
  if (status !== 200) return false;
  const server = serverObject(body);
  return Boolean(
    server &&
      server.id === expected.id &&
      server.name === expected.name &&
      server.ipAddress === expected.ipAddress &&
      server.port === expected.port &&
      server.visibility === expected.visibility,
  );
}
