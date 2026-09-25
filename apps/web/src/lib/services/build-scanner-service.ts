import net from "node:net";
import { config } from "@nexus/config";
import { writeClamAvInstream } from "./clamav-instream";

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
 * Non-production environments may deliberately disable scanning. That state is
 * explicit and can never be approved as a clean build. Production configuration
 * requires ClamAV.
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

const CLAMAV_TIMEOUT_MS = 30_000;
const CLAMAV_MAX_RESPONSE_BYTES = 8 * 1024;

export const clamAvScanner: BuildScanner = {
  async scan({ bytes }) {
    const scannedAt = new Date();
    return new Promise<BuildScanResult>((resolve) => {
      const socket = net.createConnection({ host: config.CLAMAV_HOST, port: config.CLAMAV_PORT });
      let response = "";
      let settled = false;
      const finish = (result: BuildScanResult) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(CLAMAV_TIMEOUT_MS);
      socket.on("connect", () => {
        void writeClamAvInstream(socket, bytes).catch((error: unknown) => {
          finish({
            status: "error",
            scanner: "clamav",
            scannedAt,
            reason:
              error instanceof Error
                ? error.message
                : "Scanner stream failed",
          });
        });
      });
      socket.on("data", (chunk) => {
        if (settled) return;
        response += chunk.toString("utf8");
        if (Buffer.byteLength(response, "utf8") > CLAMAV_MAX_RESPONSE_BYTES) {
          finish({
            status: "error",
            scanner: "clamav",
            scannedAt,
            reason: "Scanner response exceeded limit",
          });
        }
      });
      socket.on("end", () => {
        const verdict = response.replace(/\0/g, "").trim();
        if (/\bOK$/.test(verdict)) {
          finish({ status: "clean", scanner: "clamav", scannedAt });
        } else if (/\bFOUND$/.test(verdict)) {
          finish({ status: "malicious", scanner: "clamav", scannedAt, reason: verdict });
        } else {
          finish({ status: "error", scanner: "clamav", scannedAt, reason: verdict || "Empty scanner response" });
        }
      });
      socket.on("timeout", () => finish({ status: "error", scanner: "clamav", scannedAt, reason: "Scanner timeout" }));
      socket.on("error", (error) => finish({ status: "error", scanner: "clamav", scannedAt, reason: error.message }));
    });
  },
};

export const buildScannerService = config.BUILD_SCANNER === "clamav"
  ? clamAvScanner
  : disabledScanner;
import net from "node:net";
import { config } from "@nexus/config";

