import { createServer, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createClamAvScanner } from "../apps/web/src/lib/services/build-scanner-service";

const servers: ReturnType<typeof createServer>[] = [];
const sockets = new Set<Socket>();

async function scanWithMockClamAv(
  reply: string | null,
  options: { timeoutMs?: number } = {}
) {
  let received = Buffer.alloc(0);
  const server = createServer({ allowHalfOpen: true }, (socket: Socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("data", (chunk) => {
      received = Buffer.concat([received, Buffer.from(chunk)]);
    });
    socket.on("end", () => {
      if (reply !== null) socket.end(Buffer.from(`${reply}\0`));
    });
  });
  servers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Mock ClamAV did not bind a TCP port");

  const result = await createClamAvScanner({
    host: "127.0.0.1",
    port: address.port,
    timeoutMs: options.timeoutMs ?? 1_000,
  }).scan({ bytes: Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x01]), fileName: "build.zip" });

  return { result, request: received };
}

afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

describe("ClamAV INSTREAM protocol", () => {
  it("sends framed bytes and trusts only the exact clean verdict", async () => {
    const { result, request } = await scanWithMockClamAv("stream: OK");
    const fileBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x01]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(fileBytes.length);
    const expectedRequest = Buffer.concat([
      Buffer.from("zINSTREAM\0"),
      length,
      fileBytes,
      Buffer.alloc(4),
    ]);

    expect(request).toEqual(expectedRequest);
    expect(result.status).toBe("clean");
    expect(result.scanner).toBe("clamav");
    expect(result.scannedAt).toBeInstanceOf(Date);
  });

  it.each([
    "stream: Eicar-Test-Signature FOUND",
    "stream: Heuristics.Limits.Exceeded.MaxFileSize FOUND",
  ])("classifies a ClamAV FOUND reply as malicious: %s", async (reply) => {
    const { result } = await scanWithMockClamAv(reply);

    expect(result).toMatchObject({
      status: "malicious",
      scanner: "clamav",
      reason: reply,
    });
  });

  it.each([
    ["a daemon error", "stream: Access denied ERROR"],
    ["a malformed clean-looking reply", "unrecognized response OK"],
    ["an empty reply", ""],
  ])("fails closed for %s", async (_description, reply) => {
    const { result } = await scanWithMockClamAv(reply);

    expect(result.status).toBe("error");
  });

  it("fails closed when the scanner does not finish before the timeout", async () => {
    const { result } = await scanWithMockClamAv(null, { timeoutMs: 25 });

    expect(result).toMatchObject({ status: "error", reason: "Scanner timeout" });
  });
});
