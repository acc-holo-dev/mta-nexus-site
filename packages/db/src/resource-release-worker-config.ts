export function resourceReleaseWorkerOptions(
  env: Record<string, string | undefined>,
  args: readonly string[],
) {
  if (env.NEXUS_RESOURCE_RELEASE_WORKER !== "true")
    throw new Error("Resource release worker requires NEXUS_RESOURCE_RELEASE_WORKER=true");
  if (env.GITHUB_ACTIONS === "true")
    throw new Error("Resource release worker is excluded from GitHub Actions");
  if (!["development", "production", "test"].includes(env.NODE_ENV ?? ""))
    throw new Error("Resource release worker requires an explicit application environment");
  if (args.length > 1 || args.some((arg) => arg !== "--loop" && arg !== "--once"))
    throw new Error("Use --once or --loop for resource release worker");
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL ?? "");
  } catch {
    throw new Error("Resource release worker requires a database URL");
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname ||
    !url.pathname ||
    url.pathname === "/"
  )
    throw new Error("Resource release worker requires a PostgreSQL database URL");
  function integer(name: string, fallback: number, min: number, max: number) {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    if (
      !/^[1-9]\d*$/u.test(raw) ||
      !Number.isSafeInteger(Number(raw)) ||
      Number(raw) < min ||
      Number(raw) > max
    )
      throw new Error("Invalid resource release worker limits");
    return Number(raw);
  }
  return {
    loop: args[0] === "--loop",
    limit: integer("NEXUS_RESOURCE_RELEASE_WORKER_BATCH_SIZE", 20, 1, 100),
    intervalMs: integer("NEXUS_RESOURCE_RELEASE_WORKER_INTERVAL_MS", 60000, 1000, 60000),
  };
}
