const scenarios = [
  {
    id: "expired-session",
    description: "Account with an already expired session for auth/session UI checks.",
  },
  {
    id: "private-server-owner",
    description: "Owner account with one private server and an active local session.",
  },
  {
    id: "moderation-queue",
    description: "Reporter, moderator, reported server and pending moderation case.",
  },
  {
    id: "resource-scan-pending",
    description: "Developer, draft resource build and pending malware-scan state.",
  },
];

export const scenarioCatalog = Object.freeze(
  scenarios.map((scenario) => Object.freeze({ ...scenario })),
);

const scenarioIds = new Set(scenarioCatalog.map((scenario) => scenario.id));

export function isScenarioId(value) {
  return typeof value === "string" && scenarioIds.has(value);
}

function fail(message) {
  throw new Error(`Scenario Lab refused: ${message}`);
}

export function assertScenarioEnvironment(env = process.env) {
  if (env.NODE_ENV !== "development") {
    fail("NODE_ENV must be development");
  }
  if (env.NEXUS_SCENARIO_LAB !== "true") {
    fail("set NEXUS_SCENARIO_LAB=true explicitly");
  }
  if (env.GITHUB_ACTIONS === "true") {
    fail("interactive Scenario Lab is not allowed in GitHub Actions");
  }
  if (env.EMAIL_PROVIDER !== "disabled") {
    fail("EMAIL_PROVIDER must be disabled");
  }

  let database;
  try {
    database = new URL(env.DATABASE_URL ?? "");
  } catch {
    fail("DATABASE_URL must be the canonical local Docker database");
  }

  const canonicalDatabase =
    database.protocol === "postgres:" &&
    database.hostname === "postgres" &&
    (database.port === "" || database.port === "5432") &&
    database.username === "nexus" &&
    database.password === "nexus_secret" &&
    database.pathname === "/mta_nexus";

  if (!canonicalDatabase) {
    fail("DATABASE_URL must exactly target the canonical local Docker database");
  }

  let appUrl;
  try {
    appUrl = new URL(env.NEXT_PUBLIC_APP_URL ?? "");
  } catch {
    fail("NEXT_PUBLIC_APP_URL must target localhost over HTTP");
  }

  if (
    appUrl.protocol !== "http:" ||
    appUrl.hostname !== "localhost" ||
    appUrl.username ||
    appUrl.password ||
    appUrl.search ||
    appUrl.hash
  ) {
    fail("NEXT_PUBLIC_APP_URL must target localhost over HTTP");
  }

  return Object.freeze({
    databaseHost: database.hostname,
    databaseName: database.pathname.slice(1),
    appOrigin: appUrl.origin,
  });
}

export function assertScenarioId(value) {
  if (!isScenarioId(value)) {
    const known = scenarioCatalog.map((scenario) => scenario.id).join(", ");
    throw new Error(`Unknown scenario "${value ?? ""}". Available: ${known}`);
  }
  return value;
}
