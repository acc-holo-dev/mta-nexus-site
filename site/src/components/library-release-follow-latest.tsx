"use client";

import { Button } from "@nexus/ui";
import { getResourceReleaseControlCopy } from "../lib/resource-release-control-i18n";
import { LibraryReleaseCommandStatus, useLibraryReleaseCommand } from "./library-release-command";
import { useNexusLocale } from "./locale-context";

/** Compact control for library updates cards: switch a pinned preference to latest. */
export function LibraryReleaseFollowLatest({
  productId,
  actorId,
  revision,
  mode,
}: {
  productId: string;
  actorId: string;
  revision: number;
  mode: "latest" | "fixed";
}) {
  const { locale } = useNexusLocale();
  const copy = getResourceReleaseControlCopy(locale);
  const state = useLibraryReleaseCommand(productId, actorId, locale);
  const { pending, busy, saved, send } = state;
  if (mode === "latest") return null;
  return (
    <div className="space-y-3">
      <Button
        type="button"
        disabled={busy || saved || pending !== null}
        onClick={() => void send({ mode: "latest", expectedRevision: revision })}
        variant="outline"
        className="min-h-11"
      >
        {busy ? copy.saving : copy.useLatest}
      </Button>
      <LibraryReleaseCommandStatus state={state} locale={locale} />
    </div>
  );
}
