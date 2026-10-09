export class BuildArtifactMismatchError extends Error {
  constructor() {
    super("Build artifact metadata does not match storage");
  }
}

/**
 * Require provider-verified metadata before delivery. Missing size or digest
 * is not evidence of integrity, even when the database has both values.
 * The local provider hashes its opened file descriptor before returning.
 */
export function assertBuildDownloadMetadata(
  stored: { stream: NodeJS.ReadableStream; meta?: { sizeBytes?: number; sha256Hash?: string } },
  build: { fileSizeBytes: number; sha256Hash: string },
): number {
  const size = stored.meta?.sizeBytes;
  const hash = stored.meta?.sha256Hash;
  if (
    !Number.isSafeInteger(build.fileSizeBytes) ||
    build.fileSizeBytes <= 0 ||
    size !== build.fileSizeBytes ||
    !/^[a-f0-9]{64}$/u.test(build.sha256Hash) ||
    hash !== build.sha256Hash
  ) {
    (stored.stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    throw new BuildArtifactMismatchError();
  }
  return build.fileSizeBytes;
}
