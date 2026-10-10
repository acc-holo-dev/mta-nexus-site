import { asc, gt } from "drizzle-orm";
import { ServerEndpointAuditCollector } from "@nexus/domain";

async function main(): Promise<void> {
  const options = new Set(process.argv.slice(2));
  if (options.has("--help")) {
    process.stdout.write(
      "Usage: pnpm --filter @nexus/db run server:endpoint:audit [--details]\n" +
      "Read-only. --details requires NEXUS_SERVER_ENDPOINT_AUDIT_ACK=YES.\n",
    );
    return;
  }
  if ([...options].some((option) => option !== "--details")) {
    throw new Error("Unsupported endpoint audit option");
  }
  const details = options.has("--details");
  if (details && process.env.NEXUS_SERVER_ENDPOINT_AUDIT_ACK !== "YES") {
    throw new Error("Refusing private endpoint details without explicit acknowledgement");
  }

  // Do not connect to PostgreSQL until the local CLI options are validated.
  const { db, servers, closeDatabaseConnection } = await import("../src/client");
  const audit = new ServerEndpointAuditCollector();
  let afterId: string | null = null;
  try {
    while (true) {
      const rows = await db
        .select({ id: servers.id, ipAddress: servers.ipAddress, port: servers.port })
        .from(servers)
        .where(afterId === null ? undefined : gt(servers.id, afterId))
        .orderBy(asc(servers.id))
        .limit(500);

      for (const row of rows) audit.add(row);
      if (rows.length < 500) break;
      afterId = rows[rows.length - 1]!.id;
    }
  } finally {
    await closeDatabaseConnection();
  }

  const report = audit.result();
  // Private server IDs and network addresses never appear in the default
  // output, including when the audit discovers a collision.
  process.stdout.write(
    JSON.stringify(details ? report : { summary: report.summary }, null, 2) + "\n",
  );
  if (
    report.summary.invalidRows > 0 ||
    report.summary.nonCanonicalRows > 0 ||
    report.summary.collisionGroups > 0
  ) {
    // Operators must resolve all findings before adopting a unique index.
    process.exitCode = 2;
  }
}

main().catch((error: unknown) => {
  // Do not print connection strings or raw database errors.
  process.stderr.write(
    "MTA endpoint audit failed (" +
      (error instanceof Error ? error.name : "UnknownError") + ")\n",
  );
  process.exitCode = 1;
});
