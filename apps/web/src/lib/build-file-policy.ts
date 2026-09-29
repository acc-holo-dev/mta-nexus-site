export const MAX_BUILD_FILE_SIZE_BYTES = 64 * 1024 * 1024;

const SUPPORTED_BUILD_EXTENSIONS = ["zip", "rar", "7z", "lua"] as const;

export type SupportedBuildExtension = (typeof SUPPORTED_BUILD_EXTENSIONS)[number];

export function getSupportedBuildExtension(fileName: string): SupportedBuildExtension | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return SUPPORTED_BUILD_EXTENSIONS.find((supported) => supported === extension) ?? null;
}

export function getBuildFileValidationError(
  file: { name: string; size: number } | null
): string | null {
  if (!file || file.size <= 0) return "Choose a build archive";
  if (!getSupportedBuildExtension(file.name)) {
    return "Choose a .zip, .rar, .7z, or .lua build file";
  }
  if (file.size > MAX_BUILD_FILE_SIZE_BYTES) {
    return "Build files must be 64 MiB or smaller";
  }
  return null;
}
