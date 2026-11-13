import {
  resourceBuildTargetStatus,
  type ResourceBuildCommand,
  type ResourceBuildView,
} from "@nexus/domain";
export function confirmedBuildCommand(
  status: number,
  body: unknown,
  before: Pick<ResourceBuildView, "id" | "productId" | "version" | "status" | "revision">,
  command: ResourceBuildCommand,
): null | Pick<
  ResourceBuildView,
  "id" | "productId" | "version" | "status" | "revision" | "releaseNotes" | "mtaVersionTarget"
> {
  if (status < 200 || status >= 300 || !body || typeof body !== "object") return null;
  const value = (body as { build?: unknown }).build;
  if (!value || typeof value !== "object") return null;
  const build = value as Record<string, unknown>;
  const sameRevisionSave = command.action === "save" && before.status === "draft";
  if (
    build.id !== before.id ||
    build.productId !== before.productId ||
    build.version !== before.version ||
    build.status !== resourceBuildTargetStatus(before.status, command.action) ||
    (build.revision !== before.revision + 1 &&
      !(sameRevisionSave && build.revision === before.revision)) ||
    !(build.releaseNotes === null || typeof build.releaseNotes === "string") ||
    !(build.mtaVersionTarget === null || typeof build.mtaVersionTarget === "string")
  )
    return null;
  if (
    command.action === "save" &&
    (build.releaseNotes !== (command.releaseNotes.trim() || null) ||
      build.mtaVersionTarget !== (command.mtaVersionTarget.trim() || null))
  )
    return null;
  return build as unknown as NonNullable<ReturnType<typeof confirmedBuildCommand>>;
}
