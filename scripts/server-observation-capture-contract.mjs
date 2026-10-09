export function assertServerObservationCaptureEnvironment(
  env = process.env,
) {
  if (env.NEXUS_SERVER_OBSERVATION_CAPTURE !== "true") {
    throw new Error(
      "Server observation capture refused: set NEXUS_SERVER_OBSERVATION_CAPTURE=true explicitly",
    );
  }

  if (env.GITHUB_ACTIONS === "true") {
    throw new Error(
      "Server observation capture refused: interactive capture is not allowed in GitHub Actions",
    );
  }

  if (env.NODE_ENV !== "development") {
    throw new Error(
      "Server observation capture refused: NODE_ENV must be development",
    );
  }

  let database;
  try {
    database = new URL(env.DATABASE_URL ?? "");
  } catch {
    throw new Error(
      "Server observation capture refused: DATABASE_URL must be the canonical local Docker database",
    );
  }

  const canonicalDatabase =
    database.protocol === "postgres:" &&
    database.hostname === "postgres" &&
    (database.port === "" || database.port === "5432") &&
    database.username === "nexus" &&
    database.password === "nexus_secret" &&
    database.pathname === "/mta_nexus";

  if (!canonicalDatabase) {
    throw new Error(
      "Server observation capture refused: DATABASE_URL must be the canonical local Docker database",
    );
  }

  return Object.freeze({
    environment: "development",
    databaseHost: database.hostname,
    databaseName: database.pathname.slice(1),
  });
}

/** A stale source never advances the durable observation capture checkpoint. */
export function assertServerObservationCaptureResult(result) {
  if (result?.sourceWasStale === true) {
    throw new Error(
      "Server observation capture deferred: the MTA master snapshot is stale; retry without a resume cursor",
    );
  }
}
