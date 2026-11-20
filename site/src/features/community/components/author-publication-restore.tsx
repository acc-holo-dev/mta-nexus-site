"use client";
import { Button, ErrorState } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import {
  organizationPublicationHistoryCopy,
  organizationPublicationHistoryError,
} from "../../organizations/organization-publication-history-copy";
import {
  serverPublicationHistoryCopy,
  serverPublicationHistoryError,
} from "../../servers/server-publication-history-copy";
import { confirmAction } from "../../shell/confirm-action";
import { linkAccentSm, linkGhostAccentSm, linkMinHAccentSemibold } from "../../shell/link-shell";
import { panelClipSpace3P4 } from "../../shell/panel-shell";
import { confirmedAuthorPublicationRestore } from "../author-publication-desk-contract";
import {
  authorPublicationDeskCopy,
  authorPublicationDeskError,
} from "../author-publication-desk-copy";
import { confirmedOrganizationPublicationRestore } from "../organization-publication-history-contract";
import { confirmedServerPublicationRestore } from "../server-publication-history-contract";
import { platformRequest } from "../user-platform-client";
import { getUserPlatformCopy } from "../user-platform-copy";
export function AuthorPublicationRestore({
  id,
  revision,
  locale,
  organizationId,
  serverId,
}: {
  id: string;
  revision: string;
  locale: Locale;
  organizationId?: string;
  serverId?: string;
}) {
  const router = useRouter();
  const orgCopy = serverId
    ? serverPublicationHistoryCopy(locale)
    : organizationPublicationHistoryCopy(locale);
  const copy = {
      ...authorPublicationDeskCopy(locale),
      ...(organizationId || serverId
        ? {
            restoreHelp: orgCopy.restoreHelp,
            restoreConfirm: orgCopy.restoreConfirm,
            restoreDenied: orgCopy.restoreDenied,
            restoredNotice: orgCopy.restoredNotice,
          }
        : {}),
    },
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [saved, setSaved] = useState(false),
    [blocked, setBlocked] = useState(false);
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(getUserPlatformCopy(locale))].includes(text)
      ? text
      : fallback;
  }
  const pending = useRef(false),
    mounted = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  async function restore() {
    if (
      pending.current ||
      blocked ||
      saved ||
      !(await confirmAction({
        title: copy.restore,
        object: id,
        consequences: copy.restoreConfirm,
        confirmLabel: copy.restore,
        cancelLabel: getUserPlatformCopy(locale).back,
        closeLabel: getUserPlatformCopy(locale).back,
      }))
    )
      return;
    pending.current = true;
    setBusy(true);
    setBlocked(true);
    setNotice("");
    const active = new AbortController();
    controller.current = active;
    try {
      const result = await platformRequest(
        serverId
          ? `/api/workspace/servers/${encodeURIComponent(serverId)}/content/${encodeURIComponent(id)}/restore`
          : organizationId
            ? `/api/workspace/organizations/${encodeURIComponent(organizationId)}/content/${encodeURIComponent(id)}/restore`
            : `/api/workspace/content/${encodeURIComponent(id)}/restore`,
        locale,
        "POST",
        { expectedRevision: revision },
        active.signal,
        serverId
          ? serverPublicationHistoryError
          : organizationId
            ? organizationPublicationHistoryError
            : authorPublicationDeskError,
      );
      if (!mounted.current) return;
      if (
        !(serverId
          ? confirmedServerPublicationRestore(result, id, serverId, revision)
          : organizationId
            ? confirmedOrganizationPublicationRestore(result, id, organizationId, revision)
            : confirmedAuthorPublicationRestore(result, id, revision))
      )
        throw new Error(copy.uncertain);
      setSaved(true);
      setNotice(copy.restoredNotice);
      router.refresh();
    } catch (failure) {
      if (mounted.current) {
        setNotice(safeMessage(failure, copy.uncertain));
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className={panelClipSpace3P4} aria-busy={busy}>
      <p className="text-sm text-muted">{copy.restoreHelp}</p>
      <Button
        type="button"
        variant="outline"
        disabled={busy || blocked || saved}
        onClick={() => void restore()}
        className={linkMinHAccentSemibold}
      >
        {copy.restore}
      </Button>
      {notice && !saved ? (
        <ErrorState title={notice} description={getDictionary(locale).errors.formErrorHint} />
      ) : null}
      {notice && saved ? (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      ) : null}
      {saved ? (
        <Link
          prefetch={false}
          href={
            serverId
              ? `/workspace/servers/${encodeURIComponent(serverId)}/content/${encodeURIComponent(id)}`
              : organizationId
                ? `/workspace/organizations/${encodeURIComponent(organizationId)}/content/${encodeURIComponent(id)}`
                : `/workspace/content/${encodeURIComponent(id)}`
          }
          className={linkAccentSm}
        >
          {copy.restored}
        </Link>
      ) : blocked && !busy ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.refresh()}
          className={linkGhostAccentSm}
        >
          {copy.reload}
        </Button>
      ) : null}
    </div>
  );
}
