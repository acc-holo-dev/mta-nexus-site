import { readWebPushWorkerHealthSnapshot } from "./web-push-worker-health-state.mjs";

try {
  await readWebPushWorkerHealthSnapshot();
} catch {
  process.stderr.write("Web Push worker is not ready\n");
  process.exitCode = 1;
}
