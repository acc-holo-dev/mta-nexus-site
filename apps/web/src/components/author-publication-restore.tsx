"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { confirmedAuthorPublicationRestore } from "../lib/author-publication-desk-contract";
import {
  authorPublicationDeskCopy,
  authorPublicationDeskError,
} from "../lib/author-publication-desk-copy";
import type { Locale } from "../lib/i18n";
import { platformRequest } from "../lib/user-platform-client";
import { getUserPlatformCopy } from "../lib/user-platform-copy";
export function AuthorPublicationRestore({
  id,
  revision,
  locale,
}: {
  id: string;
  revision: string;
  locale: Locale;
}) {
  const router = useRouter();
  const copy = authorPublicationDeskCopy(locale),
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
        `/api/workspace/content/${encodeURIComponent(id)}/restore`,
        locale,
        "POST",
        { expectedRevision: revision },
        active.signal,
        authorPublicationDeskError,
      );
      if (!mounted.current) return;
      if (!confirmedAuthorPublicationRestore(result, id, revision)) throw new Error(copy.uncertain);
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
      <button
        type="button"
        disabled={busy || blocked || saved}
        onClick={() => void restore()}
        className="min-h-11 rounded-lg border border-base px-4 text-sm font-semibold text-accent disabled:opacity-50"
      >
        {copy.restore}
      </button>
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
          href={`/workspace/content/${encodeURIComponent(id)}`}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {copy.restored}
        </Link>
      ) : blocked && !busy ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-11 text-sm text-accent underline"
        >
          {copy.reload}
        </button>
      ) : null}
    </div>
  );
}
