import type { LibraryReleaseCommand } from "@nexus/domain";
import { libraryCollectionIdSchema, libraryReleaseCommandSchema } from "@nexus/validation";

export type FrozenLibraryReleaseRequest = {
  productId: string;
  href: string;
  command: LibraryReleaseCommand;
  body: string;
};
/** Capture caller-owned data before any asynchronous work; a retry never follows new props. */
export function freezeLibraryReleaseRequest(
  productId: string,
  input: LibraryReleaseCommand,
): FrozenLibraryReleaseRequest | null {
  const parsed = libraryReleaseCommandSchema.safeParse(input);
  if (!libraryCollectionIdSchema.safeParse(productId).success || !parsed.success) return null;
  const command = parsed.data;
  if (command.mode === "fixed" && command.reviewedArtifact) Object.freeze(command.reviewedArtifact);
  Object.freeze(command);
  return Object.freeze({
    productId,
    href: `/workspace/library/${encodeURIComponent(productId)}/versions`,
    command,
    body: JSON.stringify(command),
  });
}

export function matchesLibraryReleaseRequest(
  request: FrozenLibraryReleaseRequest,
  input: LibraryReleaseCommand,
) {
  const parsed = libraryReleaseCommandSchema.safeParse(input);
  return parsed.success && JSON.stringify(parsed.data) === request.body;
}
