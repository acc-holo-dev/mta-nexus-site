"use client";

import {
  canModerateLicense,
  type LicenseModerationAction,
  type LicenseOwnerAction,
} from "@nexus/domain";
import { Button, EmptyState, ErrorState, fieldClassBlock } from "@nexus/ui";
import { licenseModerationCommandSchema, licenseOwnerCommandSchema } from "@nexus/validation";
import { Server } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { confirmedLicenseControl } from "../lib/license-control-confirmation";
import { getLicenseControlCopy, licenseControlError } from "../lib/license-control-i18n";
import { privateApiRequest } from "../lib/private-api-request";
import { ActionConfirmCheckbox, actionConfirmCheckboxFocusClass } from "./action-confirm-checkbox";
import { LicenseRuntimeProbe } from "./license-runtime-probe";
import { useNexusLocale } from "./locale-context";

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
  actorId,
  initialServers,
  moderation = false,
}: {
  license: LicensePanelData;
  actorId: string;
  initialServers?: ServerPage;
  moderation?: boolean;
}) {
  const { locale } = useNexusLocale();
  const copy = getLicenseControlCopy(locale);
  const router = useRouter();
  const fieldId = useId();
  const lock = useRef(false);
  const serverRequest = useRef(0),
    epoch = useRef(0),
    abortRef = useRef<AbortController | null>(null);
  const scope = `${actorId}:${license.id}:${moderation}`;
  const currentScope = useRef(scope),
    readyScope = useRef(scope);
  if (currentScope.current !== scope) {
    currentScope.current = scope;
    epoch.current++;
  }
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

  // Reset private state when identity changes, even without a remount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scope is the identity boundary.
  useEffect(() => {
    readyScope.current = scope;
    lock.current = false;
    serverRequest.current++;
    abortRef.current?.abort();
    setSecret(null);
    setCopied(false);
    setBusy(false);
    setLoadingServers(false);
    setError("");
    setCompletedRevision("");
    setUncertainRevision("");
    setAction(actions[0]);
    setServers(initialServers ?? { servers: [], page: 1, totalPages: 1 });
    setServerId("");
    setReason("");
    setConfirmed(false);
    return () => {
      epoch.current++;
      abortRef.current?.abort();
      serverRequest.current++;
    };
  }, [scope]);
  useEffect(() => {
    const conceal = () => {
      setSecret(null);
      setCopied(false);
      if (lock.current) {
        epoch.current++;
        abortRef.current?.abort();
        lock.current = false;
        setBusy(false);
        setUncertainRevision(license.updatedAt);
        setError(copy.errors.fallback);
      }
      serverRequest.current++;
      setLoadingServers(false);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") conceal();
    };
    window.addEventListener("blur", conceal);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", conceal);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [license.updatedAt, copy.errors.fallback]);

  useEffect(() => {
    if (!secret) return;
    const timer = window.setTimeout(() => setSecret(null), 60_000);
    return () => window.clearTimeout(timer);
  }, [secret]);

  async function loadServers(page: number) {
    if (readyScope.current !== scope || currentScope.current !== scope) return;
    const operationEpoch = epoch.current;
    const sequence = ++serverRequest.current;
    setLoadingServers(true);
    setError("");
    try {
      const response = await fetch(`/api/licenses/${license.id}/servers?page=${page}`, {
        ...privateApiRequest(),
        headers: { "x-nexus-actor-id": actorId },
      });
      const body = await response.json().catch(() => null);
      if (sequence !== serverRequest.current || operationEpoch !== epoch.current) return;
      if (
        !response.ok ||
        body?.actorId !== actorId ||
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
      if (sequence === serverRequest.current && operationEpoch === epoch.current)
        setError(copy.errors.fallback);
    } finally {
      if (sequence === serverRequest.current && operationEpoch === epoch.current)
        setLoadingServers(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      readyScope.current !== scope ||
      currentScope.current !== scope ||
      lock.current ||
      refreshing ||
      !action
    )
      return;
    const operationEpoch = epoch.current;
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
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      const response = await fetch(
        moderation ? `/api/admin/licenses/${license.id}` : `/api/licenses/${license.id}/actions`,
        {
          ...privateApiRequest({ method: "POST", json: parsed.data, signal: abort.signal }),
          headers: { "Content-Type": "application/json", "x-nexus-actor-id": actorId },
        },
      );
      const body = await response.json().catch(() => null);
      if (operationEpoch !== epoch.current || abort.signal.aborted) return;
      if (
        !response.ok ||
        body?.actorId !== actorId ||
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
      if (operationEpoch === epoch.current && !abort.signal.aborted) {
        setError(copy.errors.fallback);
        setUncertainRevision(license.updatedAt);
      }
    } finally {
      if (operationEpoch === epoch.current) {
        lock.current = false;
        setBusy(false);
      }
      if (abortRef.current === abort) abortRef.current = null;
    }
  }

  const ghostLinkClass =
    "inline-flex min-h-11 items-center h-auto px-0 text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]";

  if (readyScope.current !== scope) return null;
  return (
    <section className="nexus-panel min-w-0 space-y-4 overflow-x-clip p-5">
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
        <form onSubmit={submit} className="min-w-0 space-y-4">
          <fieldset disabled={busy || refreshing} className="min-w-0 space-y-4">
            <label className="block min-w-0 text-sm text-secondary" htmlFor={`${fieldId}-action`}>
              {copy.action}
              <select
                id={`${fieldId}-action`}
                value={action}
                onChange={(event) => {
                  setAction(event.target.value as LicenseOwnerAction | LicenseModerationAction);
                  setConfirmed(false);
                }}
                className={`${fieldClassBlock} mt-1`}
              >
                {actions.map((item) => (
                  <option key={item} value={item}>
                    {copy.actions[item]}
                  </option>
                ))}
              </select>
            </label>
            {action === "bind" && (
              <div className="min-w-0 space-y-2">
                <label
                  className="block min-w-0 text-sm text-secondary"
                  htmlFor={`${fieldId}-server`}
                >
                  {copy.server}
                  <select
                    id={`${fieldId}-server`}
                    value={serverId}
                    onChange={(event) => setServerId(event.target.value)}
                    required
                    disabled={loadingServers}
                    className={`${fieldClassBlock} mt-1`}
                  >
                    <option value="">{copy.choose}</option>
                    {servers.servers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                </label>
                {servers.servers.length === 0 ? (
                  <EmptyState
                    title={copy.noServers}
                    description={copy.noServersHint}
                    icon={<Server className="h-6 w-6" aria-hidden="true" />}
                  />
                ) : null}
                <div className="flex min-w-0 flex-wrap gap-4 text-sm">
                  <Button
                    type="button"
                    variant="ghost"
                    size="touch"
                    className={ghostLinkClass}
                    disabled={loadingServers || servers.page <= 1}
                    onClick={() => void loadServers(servers.page - 1)}
                  >
                    {copy.previous}
                  </Button>
                  <span className="inline-flex min-h-11 items-center">
                    {servers.page} / {servers.totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="touch"
                    className={ghostLinkClass}
                    disabled={loadingServers || servers.page >= servers.totalPages}
                    onClick={() => void loadServers(servers.page + 1)}
                  >
                    {copy.next}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="touch"
                    className={ghostLinkClass}
                    disabled={loadingServers}
                    onClick={() => void loadServers(servers.page)}
                  >
                    {copy.refresh}
                  </Button>
                </div>
              </div>
            )}
            {action === "revoke" && <p className="text-sm text-secondary">{copy.revokeNote}</p>}
            {action === "refresh_binding" && (
              <p className="text-sm text-secondary">
                {copy.recoveryNote} · {copy.endpointRevision}: {license.currentEndpointRevision}
              </p>
            )}
            <label htmlFor={`${fieldId}-reason`} className="block min-w-0 text-sm text-secondary">
              {copy.reason}
              <textarea
                id={`${fieldId}-reason`}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={5}
                maxLength={1000}
                required
                rows={3}
                className={`${fieldClassBlock} mt-1`}
              />
            </label>
            <ActionConfirmCheckbox
              id={`${fieldId}-confirm`}
              checked={confirmed}
              onCheckedChange={setConfirmed}
              labelClassName="flex min-h-11 items-start gap-2 text-sm text-secondary"
              checkboxClassName={actionConfirmCheckboxFocusClass}
            >
              {copy.confirm}
            </ActionConfirmCheckbox>
            <Button
              type="submit"
              className="min-h-11"
              disabled={!confirmed || loadingServers}
              isLoading={busy}
            >
              {busy ? copy.pending : copy.submit}
            </Button>
          </fieldset>
        </form>
      )}
      {error ? (
        <ErrorState
          id="license-control-panel-unavailable"
          title={error}
          description={copy.formErrorHint}
          action={
            uncertainRevision === license.updatedAt ? (
              <Button type="button" variant="outline" onClick={() => window.location.reload()}>
                {copy.refresh}
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {completedRevision && !error && (
        <p
          role="status"
          className="text-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.success}
        </p>
      )}
      <Button
        type="button"
        variant="ghost"
        size="touch"
        disabled={busy}
        onClick={() => router.refresh()}
        className={ghostLinkClass}
      >
        {copy.refresh}
      </Button>
      {secret && (
        <div className="min-w-0 space-y-3 overflow-x-clip rounded-md border border-base p-4">
          <p className="text-sm text-primary">{copy.tokenOnce}</p>
          <p className="text-sm text-secondary">{copy.tokenPolicy}</p>
          <input
            aria-label={copy.tokenState}
            type="password"
            readOnly
            value={secret.value}
            autoComplete="off"
            spellCheck={false}
            className={`${fieldClassBlock} font-mono`}
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
          <div className="flex min-w-0 flex-wrap gap-4 text-sm">
            <Button
              type="button"
              variant="ghost"
              size="touch"
              className={ghostLinkClass}
              onClick={() => {
                void navigator.clipboard
                  .writeText(secret.value)
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? copy.copied : copy.copy}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="touch"
              className={ghostLinkClass}
              onClick={() => setSecret(null)}
            >
              {copy.hide}
            </Button>
          </div>
          <p className="break-words text-xs text-muted">{copy.checkEndpoint}</p>
          <LicenseRuntimeProbe licenseId={license.id} token={secret.value} locale={locale} />
        </div>
      )}
    </section>
  );
}
