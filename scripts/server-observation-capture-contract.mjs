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

  if (env.NODE_ENV !== "development" && env.NODE_ENV !== "production") {
    throw new Error(
      "Server observation capture refused: NODE_ENV must be development or production",
    );
  }

  if (!env.DATABASE_URL) {
    throw new Error(
      "Server observation capture refused: DATABASE_URL is required",
    );
  }

  return Object.freeze({
    environment: env.NODE_ENV,
  });
}
