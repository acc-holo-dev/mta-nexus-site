import { MAX_UPLOAD_FILE_SIZE_BYTES } from "@nexus/domain";

const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04], // Local file header
  [0x50, 0x4b, 0x05, 0x06], // Empty archive end record
  [0x50, 0x4b, 0x07, 0x08], // Spanned archive marker
] as const;

const RAR_SIGNATURES = [
  [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00], // RAR 1.5–4.x
  [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00], // RAR 5+
] as const;

const SEVEN_ZIP_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c] as const;

export const MAX_BUILD_FILE_SIZE_BYTES = MAX_UPLOAD_FILE_SIZE_BYTES;

const SUPPORTED_BUILD_EXTENSIONS = new Set(["zip", "rar", "7z", "lua"]);

export function getSupportedBuildExtension(fileName: string): string | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && SUPPORTED_BUILD_EXTENSIONS.has(extension) ? extension : null;
}

export function exceedsBuildFileSizeLimit(sizeBytes: number): boolean {
  return sizeBytes > MAX_BUILD_FILE_SIZE_BYTES;
}

function startsWithSignature(bytes: Uint8Array, signature: readonly number[]): boolean {
  return (
    bytes.length >= signature.length &&
    signature.every((byte, index) => bytes[index] === byte)
  );
}

/**
 * Checks file type markers only; archive structure and extractability need a real archive parser.
 */
export function hasExpectedBuildFileFormat(extension: string, bytes: Uint8Array): boolean {
  if (extension === "zip") {
    return ZIP_SIGNATURES.some((signature) => startsWithSignature(bytes, signature));
  }
  if (extension === "rar") {
    return RAR_SIGNATURES.some((signature) => startsWithSignature(bytes, signature));
  }
  if (extension === "7z") return startsWithSignature(bytes, SEVEN_ZIP_SIGNATURE);
  if (extension === "lua") {
    if (bytes.includes(0)) return false;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
