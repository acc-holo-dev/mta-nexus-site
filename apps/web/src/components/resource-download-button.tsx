"use client";

import { Button, ErrorState } from "@nexus/ui";
import { Download } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getDictionary } from "../lib/i18n";
import { resourceDeliveriesCopy } from "../lib/resource-deliveries-i18n";
import {
  type DownloadFailure,
  fetchResourceDownload,
  ResourceDownloadError,
} from "../lib/resource-download-client";
import { authEntryHref, currentBrowserReturnPath } from "./auth-return-path";
import { GuestAuthLinks } from "./guest-auth-links";
import { useNexusLocale } from "./locale-context";

export function ResourceDownloadButton({
  productId,
  version,
  buildId,
  intent,
  unavailableReason,
}: {
  productId: string;
  version: string;
  buildId?: string;
  /** Public detail uses latest; library selection uses selected/pinned. */
  intent?: "latest" | "selected";
  /** When a fixed selection exists but cannot be downloaded, explain instead of silent latest. */
  unavailableReason?: string | null;
}) {
  const { dictionary, locale } = useNexusLocale();
  const pathname = usePathname();
  const copy = dictionary.product;
  const resolvedIntent = intent ?? (buildId ? "selected" : "latest");
  const active = useRef<AbortController | null>(null);
  const downloadUrl = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<DownloadFailure | null>(null);
  const [notice, setNotice] = useState<"cancelled" | "saved" | null>(null);
  const workspaceCopy = getDictionary(locale).workspace;
  const [loginHref, setLoginHref] = useState(() => authEntryHref("login", pathname));
  const [registerHref, setRegisterHref] = useState(() => authEntryHref("register", pathname));
  const [receipt, setReceipt] = useState<{
    id: string;
    productId: string;
    buildId?: string;
    version: string;
  } | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies(pathname): Refresh login return path after client navigation.
  useEffect(() => {
    const path = currentBrowserReturnPath();
    setLoginHref(authEntryHref("login", path));
    setRegisterHref(authEntryHref("register", path));
  }, [pathname]);
  useEffect(() => {
    return () => {
      active.current?.abort();
      active.current = null;
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      downloadUrl.current = null;
    };
  }, []);

  async function download() {
    if (active.current || unavailableReason) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    setReceipt(null);
    setProgress(null);
    try {
      const result = await fetchResourceDownload(
        productId,
        controller.signal,
        (received, total) => {
          if (!controller.signal.aborted)
            setProgress(total ? Math.floor((received / total) * 100) : null);
        },
        fetch,
        buildId,
      );
      controller.signal.throwIfAborted();
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      const url = URL.createObjectURL(result.blob);
      downloadUrl.current = url;
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = result.fileName;
        document.body.append(link);
        try {
          link.click();
        } finally {
          link.remove();
        }
      } finally {
        // Allow the browser's download handoff to consume the object URL.
        setTimeout(() => {
          URL.revokeObjectURL(url);
          if (downloadUrl.current === url) downloadUrl.current = null;
        }, 60_000);
      }
      setNotice("saved");
      if (result.receiptId) setReceipt({ id: result.receiptId, productId, buildId, version });
    } catch (error) {
      if (active.current !== controller) return;
      if (controller.signal.aborted) setNotice("cancelled");
      else setFailure(error instanceof ResourceDownloadError ? error.reason : "failed");
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }

  const label =
    resolvedIntent === "selected"
      ? `${copy.downloadSelected} v${version}`
      : `${copy.downloadLatest} v${version}`;

  if (unavailableReason) {
    return (
      <div className="space-y-2">
        <p role="status" className="text-sm text-warning">
          {unavailableReason}
        </p>
        <p className="text-xs text-muted">{copy.downloadNotInstalled}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={download}
        disabled={busy}
        isLoading={busy}
        data-download-intent={resolvedIntent}
        data-build-id={buildId ?? ""}
        className="min-h-11 h-auto w-full gap-2 bg-success-solid py-3 text-sm font-bold shadow-nexus hover:opacity-90"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {busy ? copy.downloadPreparing : label}
      </Button>
      <p className="text-xs text-muted">{copy.downloadNotInstalled}</p>
      {busy && (
        <div className="space-y-2">
          <progress
            className="w-full"
            max={100}
            value={progress ?? undefined}
            aria-label={copy.downloadProgress}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => active.current?.abort()}
            className="h-auto min-h-11 px-0 text-sm text-secondary underline"
          >
            {copy.downloadCancel}
          </Button>
        </div>
      )}
      {failure ? (
        <ErrorState
          title={copy.downloadErrors[failure]}
          description={copy.downloadErrorHint}
          action={
            failure === "signIn" ? (
              <GuestAuthLinks
                loginHref={loginHref}
                registerHref={registerHref}
                signInLabel={copy.downloadSignIn}
                createAccountLabel={workspaceCopy.createAccount}
              />
            ) : undefined
          }
        />
      ) : null}
      {notice && (
        <p role="status" className="text-sm text-secondary">
          {notice === "cancelled" ? copy.downloadCancelled : copy.downloadHandedOff}
        </p>
      )}
      {receipt &&
      receipt.productId === productId &&
      receipt.buildId === buildId &&
      receipt.version === version ? (
        <Link
          href={`/workspace/library/downloads/${encodeURIComponent(receipt.id)}`}
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {resourceDeliveriesCopy(locale).details}
        </Link>
      ) : null}
    </div>
  );
}
