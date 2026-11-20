"use client";
import type { ResourceReleaseWatch, ResourceReleaseWatchCommand } from "@nexus/domain";
import { Button, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { privateApiRequest } from "../../../lib/http/private-api-request";
import { getDictionary } from "../../../lib/i18n";
import { authEntryHref, currentBrowserReturnPath } from "../../shell/auth-return";
import { confirmAction } from "../../shell/confirm-action";
import { GuestAuthLinks } from "../../shell/guest-auth";
import { linkAccent, linkAccentSm, linkMinHAccentFocus } from "../../shell/link-shell";
import { useNexusLocale } from "../../shell/locale";
import { typeSmSecondary, typeSmSuccess } from "../../shell/type-shell";
import { resourceReleaseWatchesCopy } from "../resource-release-watches-i18n";

export function ResourceReleaseWatchControl({
  watch,
  available = true,
  commerceEnabled = true,
  hasAccess = true,
  acquireHref,
  settingsHref = "/settings",
  guest = false,
  returnPath,
  /** Public detail shows full effective-state copy; library embeds keep outer notes. */
  surface = "embedded",
}: {
  watch: ResourceReleaseWatch;
  available?: boolean;
  /** Effective delivery category; false means notices stay suppressed without backlog. */
  commerceEnabled?: boolean;
  hasAccess?: boolean;
  acquireHref?: string;
  settingsHref?: string;
  guest?: boolean;
  returnPath?: string | null;
  surface?: "detail" | "embedded";
}) {
  const { locale } = useNexusLocale(),
    copy = resourceReleaseWatchesCopy(locale),
    router = useRouter(),
    lock = useRef(false),
    settled = useRef(false),
    frozen = useRef<{
      productId: string;
      command: ResourceReleaseWatchCommand;
      updatedAt: Date | null;
    } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [loginHref, setLoginHref] = useState(authEntryHref("login", returnPath ?? null)),
    [registerHref, setRegisterHref] = useState(authEntryHref("register", returnPath ?? null));
  const workspaceCopy = getDictionary(locale).workspace;
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const path = returnPath ?? currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [returnPath]);

  const canToggle = hasAccess && (available || watch.enabled);
  const disabledReason = guest
    ? null
    : !hasAccess
      ? copy.acquireRequired
      : !available && !watch.enabled
        ? copy.noSafeBuild
        : null;

  async function save() {
    if (
      lock.current ||
      settled.current ||
      guest ||
      (!frozen.current && !canToggle && !watch.enabled)
    )
      return;
    if (!frozen.current && !watch.enabled && !canToggle) return;
    if (
      !frozen.current &&
      watch.enabled &&
      !(await confirmAction({
        title: copy.stopConfirmTitle,
        object: copy.title,
        consequences: copy.stopConfirm,
        confirmLabel: copy.unwatch,
        cancelLabel: copy.cancel,
        closeLabel: copy.cancel,
        danger: false,
      }))
    )
      return;
    const request = frozen.current ?? {
      productId: watch.productId,
      command: { enabled: !watch.enabled, expectedRevision: watch.revision },
      updatedAt: watch.updatedAt,
    };
    frozen.current = request;
    setPending(true);
    lock.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    active.current = controller;
    try {
      const response = await fetch(
        `/api/library/watches/${encodeURIComponent(request.productId)}`,
        privateApiRequest({
          method: "POST",
          json: request.command,
          signal: controller.signal,
        }),
      );
      const body = await response.json().catch(() => null);
      if (active.current !== controller) return;
      if (!response.ok) {
        setError(
          body?.code === "RELEASE_WATCH_CONFLICT" || body?.code === "ACTOR_CHANGED"
            ? copy.conflict
            : body?.code === "RELEASE_WATCH_LIMIT"
              ? copy.maximum
              : body?.code === "UNAUTHORIZED" ||
                  body?.code === "ACTOR_ID_REQUIRED" ||
                  response.status === 401
                ? copy.signInRequired
                : body?.code === "FORBIDDEN" ||
                    response.status === 404 ||
                    body?.code === "RELEASE_WATCH_UNAVAILABLE"
                  ? copy.access
                  : copy.failed,
        );
        if ([400, 401, 403, 404, 409, 413, 415].includes(response.status)) {
          settled.current = true;
          setBlocked(true);
        }
        return;
      }
      if (
        !body ||
        body.productId !== request.productId ||
        body.enabled !== request.command.enabled ||
        !Number.isSafeInteger(body.revision) ||
        body.revision !== request.command.expectedRevision + 1 ||
        typeof body.updatedAt !== "string" ||
        !Number.isFinite(new Date(body.updatedAt).getTime()) ||
        new Date(body.updatedAt).toISOString() !== body.updatedAt ||
        (request.updatedAt !== null && new Date(body.updatedAt) <= request.updatedAt)
      ) {
        setError(copy.failed);
        return;
      }
      settled.current = true;
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

  if (guest) {
    return (
      <div className="space-y-2">
        <p className={typeSmSecondary}>{copy.signInRequired}</p>
        <p className="text-xs text-muted">{copy.note}</p>
        <GuestAuthLinks
          loginHref={loginHref}
          registerHref={registerHref}
          signInLabel={copy.signIn}
          createAccountLabel={workspaceCopy.createAccount}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {surface === "detail" ? (
        <>
          <p className={typeSmSecondary}>{copy.note}</p>
          <p className="text-xs text-muted">{copy.pinned}</p>
          <p className="text-xs text-muted">{copy.limit}</p>
        </>
      ) : null}
      {!commerceEnabled ? (
        <ErrorState title={copy.suppressed} description={copy.suppressedHint} />
      ) : null}
      {disabledReason ? <ErrorState title={disabledReason} description={copy.blockedHint} /> : null}
      {!hasAccess && acquireHref ? (
        <Link href={acquireHref} className={linkAccentSm}>
          {copy.acquireRequired}
        </Link>
      ) : null}
      {!pending && (
        <Button
          type="button"
          variant="outline"
          onClick={save}
          disabled={busy || saved || (!canToggle && !watch.enabled)}
          isLoading={busy}
          className={linkMinHAccentFocus}
        >
          {busy ? copy.busy : watch.enabled ? copy.unwatch : copy.watch}
        </Button>
      )}
      {pending && !saved && (
        <div className="space-y-2">
          <ErrorState
            id="resource-release-watch-pending"
            title={copy.pendingNote}
            description={copy.failedDescription}
          />
          {!blocked && (
            <Button
              type="button"
              variant="outline"
              onClick={save}
              disabled={busy}
              isLoading={busy}
              className={linkMinHAccentFocus}
            >
              {busy ? copy.busy : copy.retrySame}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.refresh()}
            disabled={busy}
            className={linkMinHAccentFocus}
          >
            {copy.reloadState}
          </Button>
        </div>
      )}
      {error ? <ErrorState title={error} description={copy.failedDescription} /> : null}
      {saved ? (
        <p role="status" className={typeSmSuccess}>
          {copy.saved}
        </p>
      ) : null}
      {surface === "detail" || !commerceEnabled ? (
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={settingsHref} className={linkAccent}>
            {copy.settings}
          </Link>
          {surface === "detail" ? (
            <Link href="/workspace/library/watches" className={linkAccent}>
              {copy.watchCenter}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
