/** Shared upload policy used by the API, storage layer, and browser UI. */
export const MAX_UPLOAD_FILE_SIZE_BYTES = 64 * 1024 * 1024;

/** Allows multipart boundaries and a small amount of form metadata around a build. */
export const MAX_BUILD_MULTIPART_OVERHEAD_BYTES = 1024 * 1024;
