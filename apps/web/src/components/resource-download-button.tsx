"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { useNexusLocale } from "./locale-context";
import {
  fetchResourceDownload,
  ResourceDownloadError,
  type DownloadFailure,
} from "../lib/resource-download-client";

export function ResourceDownloadButton({
  productId,
  version,
}: {
  productId: string;
  version: string;
}) {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.product;
  const active = useRef<AbortController | null>(null);
  const downloadUrl = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<DownloadFailure | null>(null);
  const [notice, setNotice] = useState<"cancelled" | "saved" | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
      if (downloadUrl.current) URL.revokeObjectURL(downloadUrl.current);
      downloadUrl.current = null;
    },
    [],
  );

  async function download() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setFailure(null);
    setNotice(null);
    setProgress(null);
    try {
      const result = await fetchResourceDownload(
        productId,
        controller.signal,
        (received, total) => {
          if (!controller.signal.aborted)
            setProgress(total ? Math.floor((received / total) * 100) : null);
        },
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={download}
        disabled={busy}
        aria-busy={busy}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-success-solid py-3 text-sm font-bold text-white shadow-nexus transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {busy ? copy.downloadPreparing : `${copy.downloadBuild} v${version}`}
      </button>
      {busy && (
        <div className="space-y-2">
          <progress
            className="w-full"
            max={100}
            value={progress ?? undefined}
            aria-label={copy.downloadProgress}
          />
          <button
            type="button"
            onClick={() => active.current?.abort()}
            className="text-sm text-secondary underline"
          >
            {copy.downloadCancel}
          </button>
        </div>
      )}
      {failure && (
        <p role="alert" className="text-sm text-secondary">
          {copy.downloadErrors[failure]}
        </p>
      )}
      {failure === "signIn" && (
        <Link href="/auth/login" className="text-sm text-accent underline">
          {copy.downloadSignIn}
        </Link>
      )}
      {notice && (
        <p role="status" className="text-sm text-secondary">
          {notice === "cancelled" ? copy.downloadCancelled : copy.downloadHandedOff}
        </p>
      )}
    </div>
  );
}
