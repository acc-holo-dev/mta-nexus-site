"use client";
import { useEffect, useRef, useState } from "react";
import type { LicenseReleaseConfirmation, LicenseReleaseCheck } from "@nexus/domain";
import { LICENSE_RUNTIME_TOKEN_PATTERN } from "@nexus/domain";
import { getLicenseControlCopy } from "../lib/license-control-i18n";
import {
  parseLicenseRuntimeContext,
  confirmLicenseRelease,
  type LicenseRuntimeContext,
} from "../lib/license-runtime-response";
import { privateApiRequest } from "../lib/private-api-request";

/** Uses only the parent's transient, one-time credential; never persists it. */
export function LicenseRuntimeProbe({
  licenseId,
  token,
  locale,
}: {
  licenseId: string;
  token: string;
  locale: "ru" | "en";
}) {
  const copy = getLicenseControlCopy(locale),
    [context, setContext] = useState<LicenseRuntimeContext | null>(null),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [command, setCommand] = useState<LicenseReleaseCheck | null>(null),
    [confirmed, setConfirmed] = useState<LicenseReleaseConfirmation | null>(null);
  const inFlight = useRef(false),
    checkController = useRef<AbortController | null>(null),
    sequence = useRef(0);
  useEffect(() => {
    const abort = new AbortController();
    const current = ++sequence.current;
    setLoading(true);
    setBusy(false);
    setContext(null);
    setConfirmed(null);
    setCommand(null);
    setError("");
    void (async () => {
      try {
        if (!LICENSE_RUNTIME_TOKEN_PATTERN.test(token))
          throw new Error("Invalid runtime credential");
        const response = await fetch(
          `/api/licenses/${encodeURIComponent(licenseId)}/runtime-config?page=${page}`,
          privateApiRequest({
            signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
          }),
        );
        const data = await response.json().catch(() => null),
          parsed = response.ok ? parseLicenseRuntimeContext(data, licenseId) : null;
        if (abort.signal.aborted || current !== sequence.current) return;
        if (!parsed) {
          setError(copy.releaseFailed);
          return;
        }
        setContext(parsed);
        setSelected(parsed.items[0]?.id ?? "");
      } catch {
        if (!abort.signal.aborted && current === sequence.current) setError(copy.releaseFailed);
      } finally {
        if (!abort.signal.aborted && current === sequence.current) setLoading(false);
      }
    })();
    return () => {
      abort.abort();
      checkController.current?.abort();
      sequence.current += 1;
    };
  }, [licenseId, page, token, copy.releaseFailed]);
  useEffect(() => {
    if (!confirmed) return;
    const timeout = window.setTimeout(
      () => {
        setConfirmed(null);
        setError(copy.leaseExpired);
      },
      Math.max(0, Math.min(60000, Date.parse(confirmed.leaseExpiresAt) - Date.now())),
    );
    return () => window.clearTimeout(timeout);
  }, [confirmed, copy.leaseExpired]);
  async function check() {
    const release = context?.items.find((item) => item.id === selected);
    if (inFlight.current || loading || !context || !release) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setConfirmed(null);
    const current = sequence.current,
      abort = new AbortController();
    checkController.current = abort;
    const next: LicenseReleaseCheck = {
      serverId: context.serverId,
      productId: context.productId,
      buildId: release.id,
      sha256Hash: release.sha256Hash,
      nonce: crypto.randomUUID(),
    };
    setCommand(next);
    try {
      const response = await fetch("/api/licenses/check-release", {
        method: "POST",
        cache: "no-store",
        credentials: "omit",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(next),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]),
      });
      const data = await response.json().catch(() => null);
      if (abort.signal.aborted || current !== sequence.current) return;
      if (!response.ok || !confirmLicenseRelease(data, next, licenseId, release.version)) {
        setError(copy.releaseFailed);
        return;
      }
      setConfirmed(data);
    } catch {
      if (!abort.signal.aborted && current === sequence.current) setError(copy.releaseFailed);
    } finally {
      inFlight.current = false;
      if (current === sequence.current) setBusy(false);
    }
  }
  return (
    <section className="space-y-3 border-t border-base pt-4" aria-busy={loading || busy}>
      <h3 className="font-semibold text-primary">{copy.releaseCheck}</h3>
      <p className="text-sm text-secondary">{copy.releaseNote}</p>
      {loading ? (
        <p className="text-sm text-muted">{copy.releaseLoading}</p>
      ) : context?.items.length ? (
        <>
          <label className="block text-sm">
            <span>{copy.release}</span>
            <select
              className="nexus-input mt-1 w-full"
              value={selected}
              disabled={busy}
              onChange={(event) => {
                setSelected(event.target.value);
                setConfirmed(null);
                setCommand(null);
              }}
            >
              {context.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.version}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="text-sm text-accent underline"
            disabled={busy}
            onClick={() => void check()}
          >
            {busy ? copy.pending : copy.probe}
          </button>
          {context.totalPages > 1 && (
            <div className="flex gap-4 text-sm">
              <button
                type="button"
                disabled={busy || context.page <= 1}
                onClick={() => setPage(context.page - 1)}
              >
                {copy.previous}
              </button>
              <span>
                {context.page} / {context.totalPages}
              </span>
              <button
                type="button"
                disabled={busy || context.page >= context.totalPages}
                onClick={() => setPage(context.page + 1)}
              >
                {copy.next}
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted">{copy.releaseEmpty}</p>
      )}
      {command && (
        <label className="block space-y-1 text-sm">
          <span>{copy.requestBody}</span>
          <textarea
            className="nexus-input w-full font-mono text-xs"
            readOnly
            rows={8}
            value={JSON.stringify(command, null, 2)}
          />
        </label>
      )}
      {confirmed && (
        <p role="status" className="text-sm text-accent">
          {copy.releaseSaved}{" "}
          <time dateTime={confirmed.leaseExpiresAt}>
            {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(
              new Date(confirmed.leaseExpiresAt),
            )}
          </time>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
