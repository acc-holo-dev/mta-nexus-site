import net from "node:net";
import { config } from "@nexus/config";

export type BuildScanResult =
  | { status: "not_scanned"; scanner: "disabled"; scannedAt: Date }
  | { status: "clean"; scanner: string; scannedAt: Date }
  | { status: "malicious"; scanner: string; scannedAt: Date; reason?: string }
  | { status: "error"; scanner: string; scannedAt: Date; reason?: string };

export interface BuildScanner {
  scan(input: {
    bytes: Uint8Array;
    fileName: string;
  }): Promise<BuildScanResult>;
}

/**
 * Closed beta has no malware-scanning infrastructure yet. This is deliberately
 * explicit: uploads require manual review instead of being represented as clean.
 * A ClamAV or external scanner adapter can replace this implementation without
 * changing the upload/review workflow.
 */
const disabledScanner: BuildScanner = {
  async scan() {
    return {
      status: "not_scanned",
      scanner: "disabled",
      scannedAt: new Date(),
    };
  },
};

const CLAMAV_CHUNK_BYTES = 64 * 1024;
const CLAMAV_TIMEOUT_MS = 30_000;

export function createClamAvScanner(options: {
  host: string;
  port: number;
  timeoutMs?: number;
}): BuildScanner {
  return {
    async scan({ bytes }) {
      const scannedAt = new Date();
      return new Promise<BuildScanResult>((resolve) => {
        const socket = net.createConnection({ host: options.host, port: options.port });
        let response = "";
        let settled = false;
        const finish = (result: BuildScanResult) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          resolve(result);
        };

        socket.setTimeout(options.timeoutMs ?? CLAMAV_TIMEOUT_MS);
        socket.on("connect", () => {
          socket.write("zINSTREAM\0");
          for (let offset = 0; offset < bytes.length; offset += CLAMAV_CHUNK_BYTES) {
            const chunk = bytes.subarray(offset, offset + CLAMAV_CHUNK_BYTES);
            const length = Buffer.allocUnsafe(4);
            length.writeUInt32BE(chunk.length);
            socket.write(length);
            socket.write(chunk);
          }
          socket.end(Buffer.alloc(4));
        });
        socket.on("data", (chunk) => { response += chunk.toString("utf8"); });
        socket.on("end", () => {
          const verdict = response.replace(/\0/g, "").trim();
          if (verdict === "stream: OK") {
            finish({ status: "clean", scanner: "clamav", scannedAt });
          } else if (/^stream: .+ FOUND$/.test(verdict)) {
            finish({ status: "malicious", scanner: "clamav", scannedAt, reason: verdict });
          } else {
            finish({ status: "error", scanner: "clamav", scannedAt, reason: verdict || "Empty scanner response" });
          }
        });
        socket.on("close", () => {
          finish({ status: "error", scanner: "clamav", scannedAt, reason: "Scanner connection closed without a verdict" });
        });
        socket.on("timeout", () => finish({ status: "error", scanner: "clamav", scannedAt, reason: "Scanner timeout" }));
        socket.on("error", (error) => finish({ status: "error", scanner: "clamav", scannedAt, reason: error.message }));
      });
    },
  };
}

export const clamAvScanner = createClamAvScanner({
  host: config.CLAMAV_HOST,
  port: config.CLAMAV_PORT,
});

export const buildScannerService = config.BUILD_SCANNER === "clamav"
  ? clamAvScanner
  : disabledScanner;
