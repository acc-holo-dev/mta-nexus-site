"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  canModerateLicense,
  type LicenseOwnerAction,
  type LicenseModerationAction,
} from "@nexus/domain";
import { Button } from "@nexus/ui";
import { licenseOwnerCommandSchema, licenseModerationCommandSchema } from "@nexus/validation";
import { useNexusLocale } from "./locale-context";
import { privateApiRequest } from "../lib/private-api-request";
import { getLicenseControlCopy, licenseControlError } from "../lib/license-control-i18n";
import { confirmedLicenseControl } from "../lib/license-control-confirmation";
import { LicenseRuntimeProbe } from "./license-runtime-probe";

type ServerPage = { servers: { id: string; name: string }[]; page: number; totalPages: number };
export type LicensePanelData = {
  id: string;
  status: string;
  effectiveStatus: string;
  updatedAt: string;
  canActivate: boolean;
  bindingReady: boolean;
  boundServerId: string | null;
  expiresAt: string | null;
  canRefreshBinding?: boolean;
  currentEndpointRevision?: number | null;
};

export function LicenseControlPanel({
  license,
  initialServers,
  moderation = false,
}: {
  license: LicensePanelData;
  initialServers?: ServerPage;
  moderation?: boolean;
}) {
  const { locale } = useNexusLocale();
  const copy = getLicenseControlCopy(locale);
  const router = useRouter();
  const fieldId = useId();
  const lock = useRef(false);
  const serverRequest = useRef(0);
  const actions: (LicenseOwnerAction | LicenseModerationAction)[] = moderation
    ? (["suspend", "restore", "revoke"] as const).filter(
        (action) =>
          canModerateLicense(license.status, action) &&
          (action === "revoke" ||
            (!!license.expiresAt && Date.parse(license.expiresAt) > Date.now())),
      )
    : [
        ...(license.canActivate && !license.boundServerId ? ["bind" as const] : []),
        ...(license.canActivate && license.bindingReady ? ["rotate_token" as const] : []),
        ...(license.canRefreshBinding &&
        license.currentEndpointRevision !== null &&
        license.currentEndpointRevision !== undefined
          ? ["refresh_binding" as const]
          : []),
        ...(license.boundServerId ? ["revoke_token" as const] : []),
        ...(canModerateLicense(license.status, "revoke") ? ["revoke" as const] : []),
      ];
  const [selectedAction, setAction] = useState(actions[0]);
  const action = selectedAction && actions.includes(selectedAction) ? selectedAction : actions[0];
  const [servers, setServers] = useState(initialServers ?? { servers: [], page: 1, totalPages: 1 });
  const [serverId, setServerId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingServers, setLoadingServers] = useState(false);
  const [error, setError] = useState("");
  const [completedRevision, setCompletedRevision] = useState("");
  const [uncertainRevision, setUncertainRevision] = useState("");
  const [secret, setSecret] = useState<{ value: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const refreshing =
    (!!completedRevision && Date.parse(license.updatedAt) < Date.parse(completedRevision)) ||
    uncertainRevision === license.updatedAt;

  useEffect(() => {
    if (!secret) return;
    const timer = window.setTimeout(() => setSecret(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [secret]);

  async function loadServers(page: number) {
    const sequence = ++serverRequest.current;
    setLoadingServers(true);
    setError("");
    try {
      const response = await fetch(
        `/api/licenses/${license.id}/servers?page=${page}`,
        privateApiRequest(),
      );
      const body = await response.json().catch(() => null);
      if (sequence !== serverRequest.current) return;
      if (
        !response.ok ||
        !Array.isArray(body?.servers) ||
        body.servers.length > 20 ||
        !Number.isSafeInteger(body.page) ||
        body.page < 1 ||
        !Number.isSafeInteger(body.totalPages) ||
        body.totalPages < body.page ||
        !body.servers.every(
          (item: unknown) =>
            !!item &&
            typeof item === "object" &&
            typeof (item as { id?: unknown }).id === "string" &&
            typeof (item as { name?: unknown }).name === "string",
        )
      ) {
        setError(licenseControlError(locale, body?.code));
        return;
      }
      setServers(body);
      setServerId("");
    } catch {
      if (sequence === serverRequest.current) setError(copy.errors.fallback);
    } finally {
      if (sequence === serverRequest.current) setLoadingServers(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || refreshing || !action) return;
    const command = {
      action,
      reason,
      expectedUpdatedAt: license.updatedAt,
      ...(action === "bind" ? { serverId } : {}),
      ...(action === "refresh_binding"
        ? { expectedEndpointRevision: license.currentEndpointRevision }
        : {}),
    };
    const parsed = moderation
      ? licenseModerationCommandSchema.safeParse(command)
      : licenseOwnerCommandSchema.safeParse(command);
    if (!parsed.success || !confirmed) {
      setError(copy.errors.VALIDATION_FAILED);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setSecret(null);
    setCopied(false);
    try {
      const response = await fetch(
        moderation ? `/api/admin/licenses/${license.id}` : `/api/licenses/${license.id}/actions`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const body = await response.json().catch(() => null);
      if (
        !response.ok ||
        !confirmedLicenseControl(
          body,
          license.id,
          license.updatedAt,
          action,
          license.currentEndpointRevision,
          license.expiresAt,
        )
      ) {
        setError(licenseControlError(locale, body?.code));
        if (response.status === 409 || response.status < 400 || response.status >= 500)
          setUncertainRevision(license.updatedAt);
        if (response.status === 409) router.refresh();
        return;
      }
      setCompletedRevision(body.license.updatedAt);
      setReason("");
      setConfirmed(false);
      if (body.token) setSecret(body.token);
      try {
        router.refresh();
      } catch {
        /* Keep the confirmed receipt and one-time token visible. */
      }
    } catch {
      setError(copy.errors.fallback);
      setUncertainRevision(license.updatedAt);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="nexus-panel space-y-4 p-5">
      <h2 className="text-lg font-semibold text-primary">
        {moderation ? copy.moderation : copy.title}
      </h2>
      <p className="text-sm text-secondary">{copy.policy}</p>
      {!moderation && (
        <>
          <p className="text-sm text-secondary">{copy.bindingPolicy}</p>
          <p className="text-sm text-secondary">{copy.tokenTerm}</p>
        </>
      )}
      {actions.length > 0 && (
        <form onSubmit={submit} className="space-y-4">
          <fieldset disabled={busy || refreshing} className="space-y-4">
            <label className="block text-sm text-secondary" htmlFor={`${fieldId}-action`}>
              {copy.action}
              <select
                id={`${fieldId}-action`}
                value={action}
                onChange={(event) => {
                  setAction(event.target.value as LicenseOwnerAction | LicenseModerationAction);
                  setConfirmed(false);
                }}
                className="nexus-input mt-1 w-full"
              >
                {actions.map((item) => (
                  <option key={item} value={item}>
                    {copy.actions[item]}
                  </option>
                ))}
              </select>
            </label>
            {action === "bind" && (
              <div className="space-y-2">
                <label className="block text-sm text-secondary" htmlFor={`${fieldId}-server`}>
                  {copy.server}
                  <select
                    id={`${fieldId}-server`}
                    value={serverId}
                    onChange={(event) => setServerId(event.target.value)}
                    required
                    disabled={loadingServers}
                    className="nexus-input mt-1 w-full"
                  >
                    <option value="">{copy.choose}</option>
                    {servers.servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                </label>
                {servers.servers.length === 0 && (
                  <p className="text-sm text-muted">{copy.noServers}</p>
                )}
                <div className="flex gap-4 text-sm">
                  <button
                    type="button"
                    disabled={loadingServers || servers.page <= 1}
                    onClick={() => void loadServers(servers.page - 1)}
                  >
                    {copy.previous}
                  </button>
                  <span>
                    {servers.page} / {servers.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={loadingServers || servers.page >= servers.totalPages}
                    onClick={() => void loadServers(servers.page + 1)}
                  >
                    {copy.next}
                  </button>
                  <button
                    type="button"
                    disabled={loadingServers}
                    onClick={() => void loadServers(servers.page)}
                  >
                    {copy.refresh}
                  </button>
                </div>
              </div>
            )}
            {action === "revoke" && <p className="text-sm text-secondary">{copy.revokeNote}</p>}
            {action === "refresh_binding" && (
              <p className="text-sm text-secondary">
                {copy.recoveryNote} · {copy.endpointRevision}: {license.currentEndpointRevision}
              </p>
            )}
            <label htmlFor={`${fieldId}-reason`} className="block text-sm text-secondary">
              {copy.reason}
              <textarea
                id={`${fieldId}-reason`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={5}
                maxLength={1000}
                required
                rows={3}
                className="nexus-input mt-1 w-full"
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              {copy.confirm}
            </label>
            <Button type="submit" disabled={!confirmed || loadingServers} isLoading={busy}>
              {busy ? copy.pending : copy.submit}
            </Button>
          </fieldset>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      {completedRevision && !error && (
        <p role="status" className="text-sm text-accent">
          {copy.success}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => window.location.reload()}
        className="text-sm text-accent underline"
      >
        {copy.refresh}
      </button>
      {secret && (
        <div className="space-y-3 rounded-md border border-base p-4">
          <p className="text-sm text-primary">{copy.tokenOnce}</p>
          <p className="text-sm text-secondary">{copy.tokenPolicy}</p>
          <input
            aria-label={copy.tokenState}
            type="password"
            readOnly
            value={secret.value}
            autoComplete="off"
            spellCheck={false}
            className="nexus-input w-full font-mono"
            onFocus={(event) => event.target.select()}
          />
          <p className="text-sm text-secondary">
            {copy.expires}:{" "}
            <time dateTime={secret.expiresAt}>
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
                new Date(secret.expiresAt),
              )}
            </time>
          </p>
          <div className="flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(secret.value)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? copy.copied : copy.copy}
            </button>
            <button type="button" onClick={() => setSecret(null)}>
              {copy.hide}
            </button>
          </div>
          <p className="break-words text-xs text-muted">{copy.checkEndpoint}</p>
          <LicenseRuntimeProbe licenseId={license.id} token={secret.value} locale={locale} />
        </div>
      )}
    </section>
  );
}
