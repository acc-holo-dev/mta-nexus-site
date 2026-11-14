/** Shared upload policy used by the API, storage layer, and browser UI. */
export const MAX_UPLOAD_FILE_SIZE_BYTES = 64 * 1024 * 1024;

/** Allows multipart boundaries and a small amount of form metadata around a build. */
export const MAX_BUILD_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;

/** Shared allowlist: uploaded assets must retain their real extension on download. */
const RESOURCE_UPLOAD_EXTENSIONS = new Set([
  ".zip",
  ".rar",
  ".7z",
  ".lua",
  ".luac",
  ".dff",
  ".txd",
  ".col",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".json",
  ".map",
]);

export function isAllowedResourceUploadExtension(extension: string): boolean {
  return RESOURCE_UPLOAD_EXTENSIONS.has(extension.toLowerCase());
}
