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
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  async function send(buildId?: string) {
    if (lock.current || saved) return;
    const command: LibraryReleaseCommand = buildId
      ? { mode: "fixed", buildId, expectedRevision: revision }
      : { mode: "latest", expectedRevision: revision };
    lock.current = true;
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
        if (response.status === 409 || response.status === 404) router.refresh();
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
        disabled={busy || saved || mode === "latest"}
        onClick={() => void send()}
        className="rounded-md border border-base px-4 py-2 text-sm"
      >
        {busy ? copy.saving : copy.useLatest}
      </button>
      <ul className="flex flex-wrap gap-3">
        {versions.map((version) => (
          <li key={version.id}>
            <button
              type="button"
              onClick={() => void send(version.id)}
              disabled={busy || saved || (mode === "fixed" && selectedBuildId === version.id)}
              className="rounded-md border border-base px-4 py-2 text-sm"
            >
              {copy.choose}: {version.version}
            </button>
          </li>
        ))}
      </ul>
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
