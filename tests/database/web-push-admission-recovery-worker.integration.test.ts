import { describe, expect, it } from "vitest";
import {
  freeCapacity,
  intent,
  jobs,
  mkdtemp,
  path,
  pendingFixture,
  rm,
  setupWebPushAdmissionRecovery,
  spawnSync,
  tmpdir,
} from "../helpers/web-push-admission-recovery-harness";

setupWebPushAdmissionRecovery();

describe("web-push admission recovery: worker", () => {
  it("the real worker repairs admission without VAPID and logs only aggregate results", async () => {
    const f = await pendingFixture();
    await freeCapacity();
    const root = await mkdtemp(path.join(tmpdir(), "nexus-admission-worker-"));
    try {
      const result = spawnSync(
        process.execPath,
        ["--import", "tsx", "site/packages/db/scripts/run-web-push-dispatcher.ts", "--once"],
        {
          cwd: path.resolve(import.meta.dirname, "..", ".."),
          encoding: "utf8",
          timeout: 30000,
          env: {
            ...process.env,
            WEB_PUSH_VAPID_PUBLIC_KEY: "",
            WEB_PUSH_VAPID_PRIVATE_KEY: "",
            WEB_PUSH_VAPID_SUBJECT: "",
            NEXUS_WEB_PUSH_HEALTH_FILE: path.join(root, "health.json"),
          },
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain('"status":"push-admission-recovery"');
      expect(result.stdout + result.stderr).not.toMatch(/PRIVATE_|usr_admission_|ntf_admission_/u);
      expect(await intent(f.notificationId)).toEqual([]);
      expect(await jobs(f.notificationId)).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 40000);
});
