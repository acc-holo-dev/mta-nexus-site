export function licenseMaintenanceOptions(
  env: Record<string, string | undefined>,
  args: readonly string[],
) {
  if (env.NEXUS_LICENSE_MAINTENANCE !== "true")
    throw new Error("License maintenance requires NEXUS_LICENSE_MAINTENANCE=true");
  if (env.GITHUB_ACTIONS === "true")
    throw new Error("License maintenance is excluded from GitHub Actions");
  if (!["development", "production", "test"].includes(env.NODE_ENV ?? ""))
    throw new Error("License maintenance requires an explicit application environment");
  if (args.length > 1 || args.some((arg) => arg !== "--loop" && arg !== "--once"))
    throw new Error("Use --once or --loop for license maintenance");
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL ?? "");
  } catch {
    throw new Error("License maintenance requires a database URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname ||
    url.pathname === "/"
  )
    throw new Error("License maintenance requires a PostgreSQL database URL");
  function integer(name: string, fallback: number, min: number, max: number) {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    if (
      !/^[1-9]\d*$/u.test(raw) ||
      !Number.isSafeInteger(Number(raw)) ||
      Number(raw) < min ||
      Number(raw) > max
    )
      throw new Error("Invalid license maintenance limits");
    return Number(raw);
  }
  return {
    loop: args[0] === "--loop",
    limit: integer("NEXUS_LICENSE_MAINTENANCE_BATCH_SIZE", 20, 1, 100),
    intervalMs: integer("NEXUS_LICENSE_MAINTENANCE_INTERVAL_MS", 60000, 1000, 60000),
  };
}
