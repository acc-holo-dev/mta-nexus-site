import net, { type AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createClamAvScanner } from "../apps/web/src/lib/services/build-scanner-service";

const servers: net.Server[] = [];
const connections = new Set<net.Socket>();

async function scannerFor(
  reply: string | null,
  options: { timeoutMs?: number; maxResponseBytes?: number } = {},
) {
  let request = Buffer.alloc(0);
  const server = net.createServer({ allowHalfOpen: true }, (connection) => {
    connections.add(connection);
    connection.once("close", () => connections.delete(connection));
    connection.on("data", (chunk) => {
      request = Buffer.concat([request, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
    });
    connection.on("end", () => {
      if (reply !== null) connection.end(reply);
    });
  });
  servers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;

  return {
    scanner: createClamAvScanner({ host: "127.0.0.1", port, ...options }),
    getRequest: () => request,
  };
}

afterEach(async () => {
  for (const connection of connections) connection.destroy();
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
});

describe("ClamAV scanner TCP protocol", () => {
  it("streams a build and accepts an explicit clean verdict", async () => {
    const { scanner, getRequest } = await scannerFor("stream: OK\0");
    const result = await scanner.scan({ bytes: new Uint8Array([1, 2, 3]), fileName: "build.zip" });

    expect(result.status).toBe("clean");
    const request = getRequest();
    expect(request.subarray(0, 10).toString()).toBe("zINSTREAM\0");
    expect(request.readUInt32BE(10)).toBe(3);
    expect(request.subarray(14, 17)).toEqual(Buffer.from([1, 2, 3]));
    expect(request.readUInt32BE(17)).toBe(0);
  });

  it("distinguishes malware from archives ClamAV could not fully inspect", async () => {
    const { scanner: malwareScanner } = await scannerFor("stream: Eicar-Test-Signature FOUND\0");
    const { scanner: limitedScanner } = await scannerFor(
      "stream: Heuristics.Limits.Exceeded.MaxRecursion FOUND\0",
    );

    expect(
      (await malwareScanner.scan({ bytes: new Uint8Array([1]), fileName: "malware.zip" })).status,
    ).toBe("malicious");
    expect(
      (await limitedScanner.scan({ bytes: new Uint8Array([1]), fileName: "complex.zip" })).status,
    ).toBe("rejected");
  });

  it("fails closed on malformed, oversized, or stalled daemon responses", async () => {
    const { scanner: malformedScanner } = await scannerFor("unexpected response\0");
    const { scanner: oversizedScanner } = await scannerFor("x".repeat(32), {
      maxResponseBytes: 16,
    });
    const { scanner: stalledScanner } = await scannerFor(null, { timeoutMs: 40 });

    const malformed = await malformedScanner.scan({
      bytes: new Uint8Array([1]),
      fileName: "build.zip",
    });
    const oversized = await oversizedScanner.scan({
      bytes: new Uint8Array([1]),
      fileName: "build.zip",
    });
    const stalled = await stalledScanner.scan({
      bytes: new Uint8Array([1]),
      fileName: "build.zip",
    });

    expect(malformed).toMatchObject({ status: "error", reason: "unexpected response" });
    expect(oversized).toMatchObject({ status: "error", reason: "Scanner response exceeded limit" });
    expect(stalled).toMatchObject({ status: "error", reason: "Scanner timeout" });
  });
});
