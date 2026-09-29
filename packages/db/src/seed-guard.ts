export function getDevelopmentSeedPassword(
  env: Record<string, string | undefined> = process.env
): string {
  if (env.NODE_ENV !== "development") {
    throw new Error("Database seed is restricted to NODE_ENV=development");
  }

  const password = env.DEV_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set DEV_SEED_PASSWORD to a unique value with at least 12 characters");
  }

  return password;
}
