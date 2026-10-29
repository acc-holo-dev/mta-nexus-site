import { rename, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { licenseMaintenanceOptions } from "../src/license-maintenance-config";

const healthFile = "/tmp/nexus-license-worker-health.json",
  temporary = `${healthFile}.${process.pid}.tmp`;
async function main() {
  // Validate authorization/configuration before creating a database pool.
  const options = licenseMaintenanceOptions(process.env, process.argv.slice(2));
  const [{ licenseMaintenanceRepository }, { closeDatabaseConnection }] = await Promise.all([
    import("../src/repositories/license-maintenance"),
    import("../src/client"),
  ]);
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  let status = "starting",
    lastProgressAt = new Date().toISOString(),
    failure: unknown = null,
    writing = Promise.resolve();
  function health() {
    writing = writing
      .then(async () => {
        await writeFile(
          temporary,
          JSON.stringify({
            status,
            heartbeatAt: new Date().toISOString(),
            lastProgressAt,
            limit: options.limit,
            intervalMs: options.intervalMs,
          }),
          { mode: 0o600 },
        );
        await rename(temporary, healthFile);
      })
      .catch((error: unknown) => {
        failure = error;
      });
    return writing;
  }
  const heartbeat = options.loop ? setInterval(() => void health(), 15000) : null;
  try {
    do {
      if (failure) throw failure;
      const result = await licenseMaintenanceRepository.runBatch(options.limit, controller.signal);
      lastProgressAt = new Date().toISOString();
      status = controller.signal.aborted ? "stopping" : "ready";
      if (options.loop) await health();
      process.stdout.write(`${JSON.stringify({ status, ...result })}\n`);
      if (!options.loop || controller.signal.aborted) break;
      try {
        await delay(result.processed === options.limit ? 1000 : options.intervalMs, undefined, {
          signal: controller.signal,
        });
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      }
    } while (!controller.signal.aborted);
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    status = "stopping";
    await closeDatabaseConnection();
    await rm(temporary, { force: true });
    await rm(healthFile, { force: true });
  }
  if (failure) throw failure;
}
main().catch(() => {
  process.stderr.write("License maintenance failed; inspect configuration and database health.\n");
  process.exitCode = 1;
});
