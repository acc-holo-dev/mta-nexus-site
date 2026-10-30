import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { checkDatabaseConnection } from "../packages/db/src/client";

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  label: string,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(label);
}

it("SIGTERM stops the ready loop, emits stopped, and removes the health file", async () => {
  await checkDatabaseConnection();
  const root = await mkdtemp(path.join(tmpdir(), "nexus-web-push-sigterm-"));
  const healthFile = path.join(root, "health.json");
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "packages/db/scripts/run-web-push-dispatcher.ts", "--ready"],
    {
      cwd: path.resolve(import.meta.dirname, ".."),
      env: {
        ...process.env,
        WEB_PUSH_VAPID_PUBLIC_KEY: "",
        WEB_PUSH_VAPID_PRIVATE_KEY: "",
        WEB_PUSH_VAPID_SUBJECT: "",
        NEXUS_WEB_PUSH_HEALTH_FILE: healthFile,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const exit = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });

  try {
    await waitFor(() => stdout.includes('"status":"ready"'), 20_000, "worker did not become ready");
    await waitFor(
      async () => {
        try {
          await access(healthFile);
          return true;
        } catch {
          return false;
        }
      },
      5_000,
      "health file was not written",
    );

    expect(child.kill("SIGTERM")).toBe(true);
    const result = await Promise.race([
      exit,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("worker did not exit after SIGTERM")), 15_000),
      ),
    ]);

    expect(result.signal, stderr).toBeNull();
    expect(result.code, `${stdout}\n${stderr}`).toBe(0);
    expect(stdout).toContain('"status":"stopping"');
    expect(stdout).toContain('"signal":"SIGTERM"');
    expect(stdout).toContain('"status":"stopped"');
    expect(stdout + stderr).not.toContain("PRIVATE_");

    await expect(access(healthFile)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exit.catch(() => undefined);
    }
    await rm(root, { recursive: true, force: true });
  }
}, 45_000);
