"use client";
import type { LibraryReleaseCommand } from "@nexus/domain";
import { Button } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  type FrozenLibraryReleaseRequest,
  freezeLibraryReleaseRequest,
  matchesLibraryReleaseRequest,
} from "../lib/library-release-request";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedLibraryRelease } from "../lib/resource-release-control-confirmation";
import {
  getResourceReleaseControlCopy,
  resourceReleaseControlError,
} from "../lib/resource-release-control-i18n";
export function useLibraryReleaseCommand(productId: string, locale: string) {
  const copy = getResourceReleaseControlCopy(locale),
    router = useRouter(),
    lock = useRef(false),
    frozen = useRef<FrozenLibraryReleaseRequest | null>(null),
    active = useRef(true),
    attempt = useRef(0),
    controller = useRef<AbortController | null>(null),
    terminal = useRef(false),
    currentProduct = useRef(productId);
  currentProduct.current = productId;
  const [pending, setPending] = useState<LibraryReleaseCommand | null>(null),
    [blocked, setBlocked] = useState(false),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      attempt.current++;
      controller.current?.abort();
      controller.current = null;
      lock.current = false;
    };
  }, []);
  async function send(command: LibraryReleaseCommand) {
    if (!active.current || lock.current || terminal.current) return;
    if (!frozen.current) {
      // Ignore a handler retained from a different resource before the first send.
      if (currentProduct.current !== productId) return;
      frozen.current = freezeLibraryReleaseRequest(productId, command);
      if (!frozen.current) {
        setError(resourceReleaseControlError(locale, "RESOURCE_CONTROL_INVALID"));
        return;
      }
    } else if (!matchesLibraryReleaseRequest(frozen.current, command)) return;
    const request = frozen.current,
      abort = new AbortController(),
      version = ++attempt.current;
    controller.current = abort;
    const current = () =>
      active.current && attempt.current === version && controller.current === abort;
    lock.current = true;
    setPending(request.command);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/library/releases/${encodeURIComponent(request.productId)}`,
        privateApiRequest({ method: "POST", json: JSON.parse(request.body), signal: abort.signal }),
      );
      const value = await response.json().catch(() => null);
      if (!current()) return;
      if (!response.ok || !confirmedLibraryRelease(value, request.productId, request.command)) {
        setError(resourceReleaseControlError(locale, value?.code));
        if ([400, 401, 403, 404, 409].includes(response.status)) {
          terminal.current = true;
          setBlocked(true);
        }
        return;
      }
      terminal.current = true;
      setSaved(true);
      router.refresh();
    } catch {
      if (current()) setError(copy.errors.fallback);
    } finally {
      if (current()) {
        setBusy(false);
        lock.current = false;
        controller.current = null;
      }
    }
  }
  return {
    pending,
    pendingProductId: frozen.current?.productId,
    pendingHref: frozen.current?.href,
    blocked,
    busy,
    saved,
    error,
    send,
  };
}
export function LibraryReleaseCommandStatus({
  state,
  locale,
}: {
  state: ReturnType<typeof useLibraryReleaseCommand>;
  locale: string;
}) {
  const { pending, pendingProductId, pendingHref, blocked, busy, saved, error, send } = state;
  const copy = getResourceReleaseControlCopy(locale);
  return (
    <>
      {pending && pendingHref ? (
        <div className="space-y-2 text-sm">
          <Link href={pendingHref} className="break-all text-accent underline">
            {copy.pendingResource}: {pendingProductId}
          </Link>
          <p>
            {copy.revision}: {pending.expectedRevision}
          </p>
          {pending.mode === "fixed" ? (
            <>
              <p>
                {copy.pendingBuild}: <code className="break-all">{pending.buildId}</code>
              </p>
              {pending.reviewedArtifact ? (
                <>
                  <p>
                    {copy.pendingHash}:{" "}
                    <code className="break-all">{pending.reviewedArtifact.sha256Hash}</code>
                  </p>
                  <p>
                    {copy.pendingSize}: {pending.reviewedArtifact.fileSizeBytes}
                  </p>
                </>
              ) : null}
            </>
          ) : (
            <p>{copy.latest}</p>
          )}
        </div>
      ) : null}
      {pending && !saved ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">{copy.pendingNote}</p>
          {!blocked ? (
            <Button
              type="button"
              disabled={busy}
              onClick={() => void send(pending)}
              variant="outline"
            >
              {copy.retrySame}
            </Button>
          ) : null}
          <Button
            type="button"
            disabled={busy}
            onClick={() => window.location.reload()}
            variant="outline"
          >
            {copy.reloadState}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <div className="space-y-2">
          <p role="status" className="text-sm text-success">
            {copy.selectSaved}
          </p>
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="h-auto px-0 text-accent underline"
            variant="ghost"
          >
            {copy.reloadState}
          </Button>
        </div>
      ) : null}
    </>
  );
}
