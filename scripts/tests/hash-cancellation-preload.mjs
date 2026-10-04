// Explicitly injected only into a secondary disposable CI Next.js process.
// Pause one real file read to make the pre-response hash phase observable.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

assert.equal(process.env.NEXUS_HASH_PROBE, "disposable-ci");
const target = resolve(process.env.NEXUS_HASH_PROBE_FILE);
const control = process.env.NEXUS_HASH_PROBE_CONTROL;
assert(target.startsWith("/data/uploads/ci-resource-browser/"));
assert(control.startsWith("/tmp/nexus-hash-probe-"));
async function publishMarker(name, data) {
  const temporary = join(control, `${name}.${randomUUID()}.tmp`);
  await fs.writeFile(temporary, JSON.stringify(data));
  await fs.rename(temporary, join(control, name));
}
const emit = Server.prototype.emit;
Server.prototype.emit = function(event, ...args) {
  if (event === "request" && args[0].url === `/api/products/${process.env.NEXUS_RESOURCE_BROWSER_PRODUCT_ID}/download`) {
    args[1].once("close", () => {
      void publishMarker("socket-closed.json", { closed: true }).catch(() => {
        // The runner fails on the missing marker; avoid an unhandled rejection.
        process.exitCode = 1;
      });
    });
  }
  return emit.call(this, event, ...args);
};
const open = fs.open.bind(fs);
let armed = true;
fs.open = async (...args) => {
  const handle = await open(...args);
  if (resolve(String(args[0])) !== target || !armed) return handle;
  armed = false;
  const read = handle.read.bind(handle);
  const close = handle.close.bind(handle);
  let reads = 0;
  handle.read = async (...readArgs) => {
    const result = await read(...readArgs);
    reads++;
    await publishMarker("started.json", { reads, bytesRead: result.bytesRead });
    const deadline = Date.now() + 15_000;
    while (true) {
      try { await fs.access(join(control, "release")); break; }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (Date.now() > deadline) throw new Error("Hash probe release timeout");
      await delay(20);
    }
    return result;
  };
  handle.close = async () => {
    await close();
    await publishMarker("closed.json", { reads });
  };
  return handle;
};
