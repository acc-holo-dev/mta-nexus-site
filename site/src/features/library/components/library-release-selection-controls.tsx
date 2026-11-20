"use client";
import { Button } from "@nexus/ui";
import { libraryReleaseCommandSchema } from "@nexus/validation";
import { useNexusLocale } from "../../shell/locale";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { getResourceReleaseControlCopy } from "../resource-release-control-i18n";
import { LibraryReleaseCommandStatus, useLibraryReleaseCommand } from "./library-release-command";
export function LibraryReleaseSelectionControls({
  productId,
  actorId,
  revision,
  mode,
  selectedBuildId,
  versions,
}: {
  productId: string;
  actorId: string;
  revision: number;
  mode: "latest" | "fixed";
  selectedBuildId: string | null;
  versions: { id: string; version: string; sha256Hash: string; fileSizeBytes: number }[];
}) {
  const { locale } = useNexusLocale();
  const copy = getResourceReleaseControlCopy(locale);
  const state = useLibraryReleaseCommand(productId, actorId, locale);
  const { pending, busy, saved, send } = state;
  return (
    <section className={panelSpace4P5}>
      <p className="text-xs text-muted">
        {copy.revision}: {revision}
      </p>
      <Button
        type="button"
        disabled={busy || saved || pending !== null || mode === "latest"}
        onClick={() => void send({ mode: "latest", expectedRevision: revision })}
        variant="outline"
      >
        {busy ? copy.saving : copy.useLatest}
      </Button>
      <ul className="flex flex-wrap gap-3">
        {versions.map((version) => {
          const command = {
            mode: "fixed" as const,
            buildId: version.id,
            expectedRevision: revision,
            reviewedArtifact: {
              sha256Hash: version.sha256Hash,
              fileSizeBytes: version.fileSizeBytes,
            },
          };
          const valid = libraryReleaseCommandSchema.safeParse(command).success;
          return (
            <li key={version.id}>
              <Button
                type="button"
                onClick={() => {
                  if (valid) void send(command);
                }}
                disabled={
                  busy ||
                  saved ||
                  pending !== null ||
                  !valid ||
                  (mode === "fixed" && selectedBuildId === version.id)
                }
                variant="outline"
              >
                {copy.choose}: {version.version}
              </Button>
            </li>
          );
        })}
      </ul>
      <LibraryReleaseCommandStatus state={state} locale={locale} />
    </section>
  );
}
