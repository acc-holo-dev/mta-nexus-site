"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResourceReleaseWatch } from "@nexus/domain";
import { privateApiRequest } from "../lib/private-api-request";
import { resourceReleaseWatchesCopy } from "../lib/resource-release-watches-i18n";
import { useNexusLocale } from "./locale-context";
export function ResourceReleaseWatchControl({
  watch,
  available = true,
}: {
  watch: ResourceReleaseWatch;
  available?: boolean;
}) {
  const { locale } = useNexusLocale(),
    copy = resourceReleaseWatchesCopy(locale),
    router = useRouter(),
    lock = useRef(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  async function save() {
    if (lock.current || saved) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    active.current = controller;
    try {
      const response = await fetch(
        `/api/library/watches/${encodeURIComponent(watch.productId)}`,
        privateApiRequest({
          method: "POST",
          json: { enabled: !watch.enabled, expectedRevision: watch.revision },
          signal: controller.signal,
        }),
      );
      const body = await response.json().catch(() => null);
      if (active.current !== controller) return;
      if (!response.ok) {
        setError(
          body?.code === "RELEASE_WATCH_CONFLICT"
            ? copy.conflict
            : body?.code === "RELEASE_WATCH_LIMIT"
              ? copy.maximum
              : response.status === 404 || body?.code === "RELEASE_WATCH_UNAVAILABLE"
                ? copy.access
                : copy.failed,
        );
        if (body?.code === "RELEASE_WATCH_CONFLICT") router.refresh();
        return;
      }
      if (
        !body ||
        body.productId !== watch.productId ||
        body.enabled !== !watch.enabled ||
        !Number.isSafeInteger(body.revision) ||
        body.revision !== watch.revision + 1
      ) {
        setError(copy.failed);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      if (active.current === controller) setError(copy.failed);
    } finally {
      if (active.current === controller) {
        active.current = null;
        lock.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={save}
        disabled={busy || saved || (!available && !watch.enabled)}
        aria-busy={busy}
        className="rounded-md border border-base px-4 py-2 text-sm text-accent disabled:opacity-60"
      >
        {busy ? copy.busy : watch.enabled ? copy.unwatch : copy.watch}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-secondary">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      ) : null}
    </div>
  );
}
