import type { Socket } from "node:net";

export type ClamAvInstreamSocket = Pick<
  Socket,
  "write" | "end" | "once" | "off"
>;

const CLAMAV_CHUNK_BYTES = 64 * 1024;

function waitForDrain(socket: ClamAvInstreamSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      socket.off("drain", onDrain);
      socket.off("close", onClose);
      socket.off("error", onError);
    };
    const onDrain = () => {
      cleanup();
      resolve();
    };
    const onClose = () => {
      cleanup();
      reject(new Error("ClamAV socket closed before buffered data drained"));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    socket.once("drain", onDrain);
    socket.once("close", onClose);
    socket.once("error", onError);
  });
}

async function writeChunk(
  socket: ClamAvInstreamSocket,
  chunk: string | Uint8Array,
): Promise<void> {
  if (socket.write(chunk)) return;
  await waitForDrain(socket);
}

export async function writeClamAvInstream(
  socket: ClamAvInstreamSocket,
  bytes: Uint8Array,
): Promise<void> {
  await writeChunk(socket, "zINSTREAM\0");

  for (let offset = 0; offset < bytes.length; offset += CLAMAV_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + CLAMAV_CHUNK_BYTES);
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(chunk.length);
    await writeChunk(socket, length);
    await writeChunk(socket, chunk);
  }

  await writeChunk(socket, Buffer.alloc(4));
  socket.end();
}

export const clamAvInstreamLimits = Object.freeze({
  chunkBytes: CLAMAV_CHUNK_BYTES,
});
