import assert from "node:assert/strict";
import { spawnSync, spawn } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test } from "node:test";

test(
  "production Web Push runtime interoperates with a closed TLS provider",
  { timeout: 20_000 },
  async () => {
    const root = mkdtempSync(
      join(tmpdir(), "nexus-push-provider-"),
    );
    const key = join(root, "key.pem");
    const cert = join(root, "cert.pem");

    try {
      const openssl = spawnSync(
        "openssl",
        [
          "req",
          "-x509",
          "-newkey",
          "rsa:2048",
          "-nodes",
          "-keyout",
          key,
          "-out",
          cert,
          "-subj",
          "/CN=push.example.net",
          "-addext",
          "subjectAltName=DNS:push.example.net",
          "-days",
          "1",
        ],
        { encoding: "utf8" },
      );
      assert.ifError(openssl.error);
      assert.equal(
        openssl.status,
        0,
        openssl.stderr || "openssl failed",
      );

      const received = [];
      const server = createServer(
        {
          key: readFileSync(key),
          cert: readFileSync(cert),
        },
        async (request, response) => {
          const chunks = [];
          for await (const chunk of request) {
            chunks.push(Buffer.from(chunk));
          }
          const body = Buffer.concat(chunks);
          received.push({
            path: request.url,
            method: request.method,
            host: request.headers.host,
            authorization: request.headers.authorization,
            ttl: request.headers.ttl,
            encoding: request.headers["content-encoding"],
            type: request.headers["content-type"],
            length: request.headers["content-length"],
            servername: request.socket.servername,
            body,
          });

          if (request.url?.endsWith("/hang")) {
            return;
          }
          const status = Number(
            request.url?.split("/").pop(),
          );
          if (status === 503) {
            response.setHeader("Retry-After", "7");
          }
          response.writeHead(status);
          response.end();
        },
      );

      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const address = server.address();
      assert(
        address &&
          typeof address === "object" &&
          address.port > 0,
      );

      const child = spawn(
        process.execPath,
        [
          "--import",
          "tsx",
          "scripts/tests/web-push-network-client.ts",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_EXTRA_CA_CERTS: cert,
            NEXUS_PUSH_TEST_PORT: String(address.port),
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (value) => {
        stdout += value;
      });
      child.stderr.on("data", (value) => {
        stderr += value;
      });
      const [code] = await once(child, "exit");

      server.closeAllConnections();
      await new Promise((resolve) =>
        server.close(resolve),
      );

      assert.equal(code, 0, stderr);
      const result = JSON.parse(stdout);
      assert.deepEqual(result.statuses, [201, 410, 503]);
      assert.equal(result.retryAfterMs, 7_000);
      assert.equal(result.timeoutRejected, true);
      assert.equal(received.length, 4);

      for (const item of received) {
        assert.equal(item.method, "POST");
        assert.equal(item.host, "push.example.net");
        assert.equal(item.servername, "push.example.net");
        assert.equal(item.ttl, "60");
        assert.equal(item.encoding, "aes128gcm");
        assert.equal(
          item.type,
          "application/octet-stream",
        );
        assert.match(
          item.authorization ?? "",
          /^vapid t=[^.]+\.[^.]+\.[^,]+, k=/u,
        );
        assert.equal(
          Number(item.length),
          item.body.length,
        );
        assert(item.body.length > 86);
        assert(item.body.length <= 4096);
        assert.equal(item.body.readUInt32BE(16), 4096);
        assert.equal(item.body[20], 65);
        assert.equal(
          item.body.includes(
            Buffer.from(
              "Closed TLS provider acceptance",
              "utf8",
            ),
          ),
          false,
        );
      }

      assert.deepEqual(
        received.slice(0, 3).map((item) => item.path),
        [
          "/subscriptions/201",
          "/subscriptions/410",
          "/subscriptions/503",
        ],
      );
      assert.equal(
        received[3]?.path,
        "/subscriptions/hang",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);
