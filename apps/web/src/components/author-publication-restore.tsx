"use client";
import { Button } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { confirmedAuthorPublicationRestore } from "../lib/author-publication-desk-contract";
import {
  authorPublicationDeskCopy,
  authorPublicationDeskError,
} from "../lib/author-publication-desk-copy";
import type { Locale } from "../lib/i18n";
import { confirmedOrganizationPublicationRestore } from "../lib/organization-publication-history-contract";
import {
  organizationPublicationHistoryCopy,
  organizationPublicationHistoryError,
} from "../lib/organization-publication-history-copy";
import { confirmedServerPublicationRestore } from "../lib/server-publication-history-contract";
import {
  serverPublicationHistoryCopy,
  serverPublicationHistoryError,
} from "../lib/server-publication-history-copy";
import { platformRequest } from "../lib/user-platform-client";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
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
    if (pending.current || blocked || saved || !window.confirm(copy.restoreConfirm)) return;
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
        const message = failure instanceof Error ? failure.message : "";
        setNotice(
          [...Object.values(copy), ...Object.values(getUserPlatformCopy(locale))].includes(message)
            ? message
            : copy.uncertain,
        );
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="nexus-panel space-y-3 p-4" aria-busy={busy}>
      <p className="text-sm text-muted">{copy.restoreHelp}</p>
      <Button
        type="button"
        variant="outline"
        disabled={busy || blocked || saved}
        onClick={() => void restore()}
        className="min-h-11 font-semibold text-accent"
      >
        {copy.restore}
      </Button>
      {notice && (
        <p
          role={saved ? "status" : "alert"}
          className={saved ? "text-sm text-success" : "text-sm text-danger"}
        >
          {notice}
        </p>
      )}
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
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.restored}
        </Link>
      ) : blocked && !busy ? (
        <Button
          type="button"
          variant="ghost"
          onClick={() => window.location.reload()}
          className="h-auto min-h-11 px-0 text-sm text-accent underline"
        >
          {copy.reload}
        </Button>
      ) : null}
    </div>
  );
}
