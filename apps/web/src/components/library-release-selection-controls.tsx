"use client";
import { getResourceReleaseControlCopy } from "../lib/resource-release-control-i18n";
import { useLibraryReleaseCommand, LibraryReleaseCommandStatus } from "./library-release-command";
import { useNexusLocale } from "./locale-context";
export function LibraryReleaseSelectionControls({
  productId,
  revision,
  mode,
  selectedBuildId,
  versions,
}: {
  productId: string;
  revision: number;
  mode: "latest" | "fixed";
  selectedBuildId: string | null;
  versions: { id: string; version: string }[];
}) {
  const { locale } = useNexusLocale();
  const copy = getResourceReleaseControlCopy(locale);
  const state = useLibraryReleaseCommand(productId, locale);
  const { pending, busy, saved, send } = state;
  return (
    <section className="nexus-panel space-y-4 p-5">
      <p className="text-xs text-muted">
        {copy.revision}: {revision}
      </p>
      <button
        type="button"
        disabled={busy || saved || pending !== null || mode === "latest"}
        onClick={() => void send({ mode: "latest", expectedRevision: revision })}
        className="rounded-md border border-base px-4 py-2 text-sm"
      >
        {busy ? copy.saving : copy.useLatest}
      </button>
      <ul className="flex flex-wrap gap-3">
        {versions.map((version) => (
          <li key={version.id}>
            <button
              type="button"
              onClick={() =>
                void send({ mode: "fixed", buildId: version.id, expectedRevision: revision })
              }
              disabled={
                busy ||
                saved ||
                pending !== null ||
                (mode === "fixed" && selectedBuildId === version.id)
              }
              className="rounded-md border border-base px-4 py-2 text-sm"
            >
              {copy.choose}: {version.version}
            </button>
          </li>
        ))}
      </ul>
      <LibraryReleaseCommandStatus state={state} locale={locale} />
    </section>
  );
}
