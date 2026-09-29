export class BuildArtifactMismatchError extends Error {
  constructor() {
    super("Build artifact metadata does not match storage");
  }
}

/** Compare metadata supplied by storage; this does not rehash a local file. */
export function assertBuildDownloadMetadata(
  stored: { stream: NodeJS.ReadableStream; meta?: { sizeBytes?: number; sha256Hash?: string } },
  build: { fileSizeBytes: number; sha256Hash: string },
): number {
  const size = stored.meta?.sizeBytes;
  const hash = stored.meta?.sha256Hash;
  if (
    !Number.isSafeInteger(build.fileSizeBytes) ||
    build.fileSizeBytes <= 0 ||
    (size !== undefined && size !== build.fileSizeBytes) ||
    (hash !== undefined && hash !== build.sha256Hash)
  ) {
    (stored.stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    throw new BuildArtifactMismatchError();
  }
  return build.fileSizeBytes;
}
