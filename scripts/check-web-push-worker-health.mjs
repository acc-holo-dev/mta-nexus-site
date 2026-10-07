import { readWebPushWorkerHealthSnapshot } from "./web-push-worker-health-state.mjs";

try {
  await readWebPushWorkerHealthSnapshot();
} catch {
  process.exitCode = 1;
}
