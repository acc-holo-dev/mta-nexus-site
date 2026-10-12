"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LibraryReleaseCommand } from "@nexus/domain";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedLibraryRelease } from "../lib/resource-release-control-confirmation";
import {
  getResourceReleaseControlCopy,
  resourceReleaseControlError,
} from "../lib/resource-release-control-i18n";
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
  const { locale } = useNexusLocale(),
    copy = getResourceReleaseControlCopy(locale),
    router = useRouter(),
    lock = useRef(false),
    frozen = useRef<LibraryReleaseCommand | null>(null);
  const [pending, setPending] = useState<LibraryReleaseCommand | null>(null),
    [blocked, setBlocked] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  async function send(command: LibraryReleaseCommand) {
    if (lock.current || saved || blocked) return;
    if (frozen.current && JSON.stringify(frozen.current) !== JSON.stringify(command)) return;
    frozen.current ??= command;
    command = frozen.current;
    lock.current = true;
    setPending(command);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/library/releases/${encodeURIComponent(productId)}`,
        privateApiRequest({ method: "POST", json: command }),
      );
      const value = await response.json().catch(() => null);
      if (!response.ok || !confirmedLibraryRelease(value, productId, command)) {
        setError(resourceReleaseControlError(locale, value?.code));
        if ([400, 401, 403, 404, 409].includes(response.status)) setBlocked(true);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(copy.errors.fallback);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
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
      {pending && !saved ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{copy.pendingNote}</p>
          {!blocked ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void send(pending)}
              className="rounded-md border border-base px-4 py-2 text-sm"
            >
              {copy.retrySame}
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => window.location.reload()}
            className="rounded-md border border-base px-4 py-2 text-sm"
          >
            {copy.reloadState}
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {copy.selectSaved}
        </p>
      ) : null}
    </section>
  );
}
