import assert from "node:assert/strict";
import { X509Certificate } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import tls from "node:tls";
import { prepareDevMailpit } from "../prepare-dev-mailpit.mjs";

const env = { NODE_ENV: "development" };
function directory(t) {
  const path = mkdtempSync(join(tmpdir(), "nexus-dev-mail-"));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

test("mail setup refuses production, unspecified mode and relative directories", (t) => {
  const path = directory(t);
  assert.throws(() => prepareDevMailpit(path, { NODE_ENV: "production" }), /development-only/);
  assert.throws(() => prepareDevMailpit(path, {}), /development-only/);
  assert.throws(() => prepareDevMailpit("relative", env), /absolute/);
});

test("repeated startup preserves independent queue keys and the valid TLS certificate", (t) => {
  const path = directory(t);
  const files = prepareDevMailpit(path, env);
  const before = Object.values(files).map((file) => readFileSync(file));
  assert.notDeepEqual(before[0], before[1]);
  for (const file of [files.keyFile, files.abuseKeyFile]) {
    const key = readFileSync(file, "utf8");
    assert.equal(Buffer.from(key, "base64url").length, 32);
    assert.equal(Buffer.from(key, "base64url").toString("base64url"), key);
  }
  for (const file of [files.keyFile, files.abuseKeyFile, files.tlsKeyFile]) {
    assert.equal(statSync(file).mode & 0o777, 0o600);
  }
  assert.equal(new X509Certificate(before[2]).checkHost("mailpit"), "mailpit");
  prepareDevMailpit(path, env);
  assert.deepEqual(
    Object.values(files).map((file) => readFileSync(file)),
    before,
  );
});

test("a corrupted queue key fails visibly without rotating existing keys", (t) => {
  const path = directory(t);
  const files = prepareDevMailpit(path, env);
  const abuseKey = readFileSync(files.abuseKeyFile);
  writeFileSync(files.keyFile, "invalid-key");
  assert.throws(() => prepareDevMailpit(path, env), /refusing to rotate/);
  assert.equal(readFileSync(files.keyFile, "utf8"), "invalid-key");
  assert.deepEqual(readFileSync(files.abuseKeyFile), abuseKey);
});

test("generated CA verifies a real TLS connection and rejects a different server name", async (t) => {
  const files = prepareDevMailpit(directory(t), env);
  const cert = readFileSync(files.certFile);
  const server = tls.createServer({ cert, key: readFileSync(files.tlsKeyFile) }, (socket) =>
    socket.end(),
  );
  server.on("tlsClientError", () => {});
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const connect = (servername) =>
    new Promise((resolve, reject) => {
      const socket = tls.connect({
        host: "127.0.0.1",
        port,
        servername,
        ca: cert,
        rejectUnauthorized: true,
      });
      socket.once("error", reject);
      socket.once("secureConnect", () => {
        resolve(socket.authorized);
        socket.destroy();
      });
    });
  assert.equal(await connect("mailpit"), true);
  await assert.rejects(connect("wrong-host.invalid"), { code: "ERR_TLS_CERT_ALTNAME_INVALID" });
});
