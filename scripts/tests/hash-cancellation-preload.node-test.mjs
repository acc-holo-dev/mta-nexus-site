import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { isHashProbeFile } from "./hash-cancellation-preload.mjs";

const fdRoot = process.platform === "darwin" ? "/dev/fd" : "/proc/self/fd";
const chunk = 64 * 1024;

if (process.env.NEXUS_HASH_PROBE_TEST_CHILD === "pinned-read") {
  const { installHashCancellationProbe } = await import("./hash-cancellation-preload.mjs");
  // Production storage uses the default export. Named `open` is a separate
  // binding and does not observe the probe's default-export patch.
  const fs = (await import("node:fs/promises")).default;
  installHashCancellationProbe({
    target: process.env.TARGET,
    control: process.env.CONTROL,
  });
  const directoryFlags = fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW;
  const fileFlags = fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK;
  const parent = await fs.open(process.env.ROOT, directoryFlags);
  const directory = await fs.open(`${fdRoot}/${parent.fd}/${process.env.DIR}`, directoryFlags);
  const buffer = Buffer.allocUnsafe(chunk);
  const decoy = await fs.open(`${fdRoot}/${directory.fd}/${process.env.DECOY}`, fileFlags);
  const decoyRead = await decoy.read(buffer, 0, buffer.length, 0);
  await fs.writeFile(join(process.env.CONTROL, "decoy-returned"), String(decoyRead.bytesRead));
  await decoy.close();
  const handle = await fs.open(`${fdRoot}/${directory.fd}/${process.env.LEAF}`, fileFlags);
  const result = await handle.read(buffer, 0, buffer.length, 0);
  await fs.writeFile(join(process.env.CONTROL, "read-returned"), String(result.bytesRead));
  await handle.close();
  await directory.close();
  await parent.close();
} else {
  async function marker(control, name) {
    try {
      return JSON.parse(await readFile(join(control, name), "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async function waitFor(check) {
    const deadline = Date.now() + 3_000;
    while (Date.now() < deadline) {
      const value = await check();
      if (value) return value;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("timed out");
  }

  test("recognizes a pinned directory-descriptor open of the probe file", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "nexus-hash-id-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const directory = join(root, "ci-resource-browser");
    await mkdir(directory);
    const target = join(directory, "asset.zip");
    const decoyPath = join(directory, "other.zip");
    await writeFile(target, Buffer.alloc(chunk, 7));
    await writeFile(decoyPath, Buffer.alloc(chunk, 9));
    const fs = await import("node:fs/promises");
    const directoryFlags = fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW;
    const fileFlags = fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK;
    const parent = await fs.open(root, directoryFlags);
    const bucket = await fs.open(`${fdRoot}/${parent.fd}/ci-resource-browser`, directoryFlags);
    const opened = await fs.open(`${fdRoot}/${bucket.fd}/asset.zip`, fileFlags);
    const decoy = await fs.open(`${fdRoot}/${bucket.fd}/other.zip`, fileFlags);
    t.after(async () => {
      await opened.close();
      await decoy.close();
      await bucket.close();
      await parent.close();
    });
    assert.equal(await isHashProbeFile(`${fdRoot}/${bucket.fd}/asset.zip`, opened, target), true);
    assert.equal(await isHashProbeFile(target, opened, target), true);
    assert.equal(await isHashProbeFile(`${fdRoot}/${bucket.fd}/other.zip`, decoy, target), false);
    assert.equal(
      await isHashProbeFile(`${fdRoot}/${parent.fd}/ci-resource-browser`, bucket, target),
      false,
    );
  });

  test("pauses the first read of a pinned open and still closes after one read", async (t) => {
    const root = await mkdtemp(join(tmpdir(), "nexus-hash-pause-"));
    const control = await mkdtemp("/tmp/nexus-hash-probe-");
    t.after(() =>
      Promise.all([
        rm(root, { recursive: true, force: true }),
        rm(control, { recursive: true, force: true }),
      ]),
    );
    const directory = join(root, "bucket");
    await mkdir(directory);
    const leaf = "asset.zip";
    const target = join(directory, leaf);
    await writeFile(target, Buffer.alloc(chunk * 2, 7));
    await writeFile(join(directory, "other.zip"), Buffer.alloc(chunk, 9));
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (key.startsWith("NODE_CHANNEL_") || key.startsWith("NODE_TEST_")) delete env[key];
    }
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
      env: {
        ...env,
        NEXUS_HASH_PROBE_TEST_CHILD: "pinned-read",
        TARGET: target,
        CONTROL: control,
        ROOT: root,
        DIR: "bucket",
        LEAF: leaf,
        DECOY: "other.zip",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunkBytes) => {
      stderr += chunkBytes;
    });
    const exited = new Promise((resolve) => child.once("exit", resolve));
    t.after(() => {
      child.kill("SIGKILL");
    });
    await waitFor(async () => {
      try {
        return await readFile(join(control, "decoy-returned"), "utf8");
      } catch (error) {
        if (error.code === "ENOENT") return null;
        throw error;
      }
    });
    const started = await waitFor(() => marker(control, "started.json"));
    assert.equal(started.reads, 1);
    assert.equal(started.bytesRead, chunk);
    assert.equal(
      await readFile(join(control, "read-returned"), "utf8").catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      }),
      null,
    );
    await writeFile(join(control, "release"), "release");
    const closed = await waitFor(() => marker(control, "closed.json"));
    assert.equal(closed.reads, 1);
    assert.equal(await exited, 0, stderr);
  });
}
