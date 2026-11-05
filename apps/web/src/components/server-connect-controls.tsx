"use client";

import { Button, ErrorState } from "@nexus/ui";
import { Copy } from "lucide-react";
import { useId, useRef, useState } from "react";
import { getDictionary, type Locale } from "../lib/i18n";

/**
 * Honest MTA connect intent: protocol link may open the client, but never proves
 * a verified play session. Clipboard success is shown only after writeText resolves.
 */
export function ServerConnectControls({
  address,
  connectUri,
  name,
  locale = "en",
  connectLabel,
  connectHint,
  showAddressField = false,
}: {
  address: string;
  connectUri: string;
  name: string;
  locale?: Locale;
  connectLabel: string;
  connectHint?: string;
  showAddressField?: boolean;
}) {
  const copy = getDictionary(locale).servers;
  const connectHintId = useId();
  const addressInput = useRef<HTMLInputElement>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [copying, setCopying] = useState(false);

  async function copyAddress() {
    setCopying(true);
    setCopyMessage("");
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(address);
      setCopyMessage(`${copy.copied}: ${address}`);
    } catch {
      if (showAddressField) {
        addressInput.current?.focus();
        addressInput.current?.select();
      } else {
        // Fallback select without a permanently focusable/aria-hidden input in the tree.
        const scratch = document.createElement("textarea");
        scratch.value = address;
        scratch.setAttribute("readonly", "");
        scratch.style.position = "fixed";
        scratch.style.left = "-9999px";
        document.body.appendChild(scratch);
        scratch.focus();
        scratch.select();
        scratch.remove();
      }
      setCopyMessage(copy.copyUnavailable);
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <a
          href={connectUri}
          aria-label={`${connectLabel}: ${name}`}
          aria-describedby={connectHint ? connectHintId : undefined}
          title={connectHint}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-success-solid px-6 py-3 text-sm font-bold text-white shadow-nexus transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]"
        >
          {connectLabel}
        </a>
        <Button
          type="button"
          variant="secondary"
          size="touch"
          aria-label={`${copy.copyAddress}: ${name}`}
          disabled={copying}
          onClick={() => void copyAddress()}
          className="min-h-11 gap-1.5"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          {copying ? copy.copying : copy.copyAddress}
        </Button>
      </div>
      {showAddressField ? (
        <label className="min-w-0 text-xs text-secondary">
          <span className="sr-only">{copy.serverAddress}</span>
          <input
            ref={addressInput}
            aria-label={`${copy.serverAddress}: ${name}`}
            readOnly
            value={address}
            onFocus={(event) => event.currentTarget.select()}
            className="mt-1 w-full select-all rounded border border-base bg-inset p-2.5 font-mono text-base text-primary"
          />
        </label>
      ) : null}
      {connectHint ? (
        <p id={connectHintId} className="text-[11px] text-faint">
          {connectHint}
        </p>
      ) : null}
      {copyMessage === copy.copyUnavailable ? (
        <ErrorState id="server-connect-copy-unavailable" title={copy.copyUnavailable} />
      ) : copyMessage ? (
        <p role="status" className="text-xs text-secondary [overflow-wrap:anywhere]">
          {copyMessage}
        </p>
      ) : null}
    </div>
  );
}
