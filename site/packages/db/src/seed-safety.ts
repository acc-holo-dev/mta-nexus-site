export const DEMO_SEED_ACKNOWLEDGEMENT = "development-only";

type SeedEnvironment = Record<string, string | undefined>;

type SeedConfiguration = {
  NODE_ENV: string;
  DATABASE_URL: string;
};

export function assertDevelopmentSeedAllowed(
  configuration: SeedConfiguration,
  environment: SeedEnvironment = process.env,
) {
  if (configuration.NODE_ENV === "production") {
    throw new Error("Demonstration seed is disabled in production");
  }
  if (environment.NEXUS_DEMO_SEED_ACK !== DEMO_SEED_ACKNOWLEDGEMENT) {
    throw new Error(
      `Refusing demonstration seed without NEXUS_DEMO_SEED_ACK=${DEMO_SEED_ACKNOWLEDGEMENT}`,
    );
  }

  let target: URL;
  try {
    target = new URL(configuration.DATABASE_URL);
  } catch {
    throw new Error("Demonstration seed requires a valid PostgreSQL DATABASE_URL");
  }
  if (!["postgres:", "postgresql:"].includes(target.protocol) || !target.pathname.slice(1)) {
    throw new Error("Demonstration seed requires a named PostgreSQL database");
  }
}
