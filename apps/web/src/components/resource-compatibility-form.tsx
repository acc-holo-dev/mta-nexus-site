"use client";
import type { Product } from "@nexus/domain";
import { Button, ErrorState, Input } from "@nexus/ui";
import { resourceCompatibilitySchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedCompatibility } from "../lib/resource-management-confirmation";
import {
  getResourceManagementCopy,
  resourceManagementError,
} from "../lib/resource-management-i18n";
import { getResourcePublisherCopy } from "../lib/resource-publisher-i18n";
import { parseEditableProfile } from "../lib/user-platform-client";
import { useNexusLocale } from "./locale-context";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 font-mono text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

export function ResourceCompatibilityForm({
  product,
  actorId,
}: {
  actorId: string;
  product: {
    id: string;
    updatedAt: string;
    compatibility: Product["compatibility"];
    suspended: boolean;
  };
}) {
  const { locale } = useNexusLocale(),
    copy = getResourceManagementCopy(locale),
    router = useRouter();
  const field = useId(),
    lock = useRef(false);
  const [mta, setMta] = useState(product.compatibility.mtaMinVersion ?? "");
  const [dependencies, setDependencies] = useState(
    (product.compatibility.dependencies ?? []).join("\n"),
  );
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState("");
  const [base, setBase] = useState(product);
  const [checked, setChecked] = useState<typeof product | null>(null);
  const [dirty, setDirty] = useState(false);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(true);
  const [foreignActor, setForeignActor] = useState(false);
  const fromProps = Date.parse(product.updatedAt) > Date.parse(base.updatedAt) ? product : null;
  const newest =
    checked && fromProps && Date.parse(fromProps.updatedAt) > Date.parse(checked.updatedAt)
      ? fromProps
      : (checked ?? fromProps);
  const disabled =
    busy || product.suspended || foreignActor || !identityVerified || needsCheck || Boolean(newest);
  function closeForeignDraft() {
    setMta("");
    setDependencies("");
    setChecked(null);
    setForeignActor(true);
    setError(copy.compatibilityIdentityChanged);
  }
  async function checkSaved() {
    if (lock.current || foreignActor) return;
    lock.current = true;
    setBusy(true);
    setIdentityVerified(false);
    setChecked(null);
    try {
      const identityResponse = await fetch("/api/account/profile", privateApiRequest());
      const identityBody = await identityResponse.json().catch(() => null);
      const identity = parseEditableProfile(identityBody?.profile);
      if (!identityResponse.ok || !identity) throw new Error(copy.compatibilityCheckFailed);
      if (identity.id !== actorId) {
        closeForeignDraft();
        return;
      }
      setIdentityVerified(true);
      const response = await fetch(
        `/api/products/${encodeURIComponent(product.id)}/compatibility`,
        privateApiRequest(),
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(copy.compatibilityCheckFailed);
      if (typeof body?.actorId !== "string") throw new Error(copy.compatibilityCheckFailed);
      if (body.actorId !== actorId) {
        closeForeignDraft();
        return;
      }
      const candidate = body?.product;
      const dependencies = candidate?.compatibility?.dependencies;
      const version = candidate?.compatibility?.mtaMinVersion;
      if (
        candidate?.id !== product.id ||
        typeof candidate?.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(candidate.updatedAt)) ||
        Date.parse(candidate.updatedAt) < Date.parse(base.updatedAt) ||
        typeof candidate?.suspended !== "boolean" ||
        !Array.isArray(dependencies) ||
        !dependencies.every((value: unknown) => typeof value === "string") ||
        !(version === undefined || typeof version === "string")
      )
        throw new Error(copy.compatibilityCheckFailed);
      setChecked({
        id: candidate.id,
        updatedAt: candidate.updatedAt,
        suspended: candidate.suspended,
        compatibility: {
          ...(version !== undefined ? { mtaMinVersion: version } : {}),
          dependencies,
        },
      });
      setError("");
    } catch {
      setError(copy.compatibilityCheckFailed);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled) return;
    const parsed = resourceCompatibilitySchema.safeParse({
      expectedUpdatedAt: base.updatedAt,
      compatibility: {
        ...(mta.trim() ? { mtaMinVersion: mta.trim() } : {}),
        dependencies: dependencies
          .split(/\r?\n|,/u)
          .map((value) => value.trim())
          .filter(Boolean),
      },
    });
    if (!parsed.success) {
      setError(copy.errors.RESOURCE_COMPATIBILITY_INVALID);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const options = privateApiRequest({ method: "POST", json: parsed.data });
      const headers = new Headers(options.headers);
      headers.set("X-Nexus-Actor-Id", actorId);
      const response = await fetch(`/api/products/${product.id}/compatibility`, {
        ...options,
        headers,
      });
      const body = await response.json().catch(() => null);
      if (body?.code === "ACTOR_CHANGED") {
        closeForeignDraft();
        return;
      }
      if (
        !response.ok ||
        !confirmedCompatibility(body, product.id, base.updatedAt, parsed.data.compatibility)
      ) {
        setError(resourceManagementError(locale, body?.code));
        setNeedsCheck(
          response.ok ||
            response.status === 409 ||
            response.status === 401 ||
            response.status === 403 ||
            response.status === 404 ||
            response.status >= 500,
        );
        return;
      }
      setSaved(true);
      setBase({
        ...product,
        updatedAt: body.product.updatedAt,
        compatibility: parsed.data.compatibility,
      });
      setDirty(false);
      router.refresh();
    } catch {
      setError(copy.errors.fallback);
      setNeedsCheck(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} aria-busy={busy} className="nexus-panel space-y-4 p-5">
      <p className="text-sm text-secondary">{copy.compatibilityNote}</p>
      {product.suspended ? (
        <ErrorState
          id="resource-compatibility-suspended-readonly"
          title={getResourcePublisherCopy(locale).readonly}
        />
      ) : (
        <p className="text-sm text-secondary">{getResourcePublisherCopy(locale).editNote}</p>
      )}
      {!foreignActor && identityVerified && (
        <>
          <Input
            id={`${field}-mta`}
            label={copy.mta}
            value={mta}
            maxLength={64}
            disabled={busy}
            readOnly={product.suspended}
            placeholder="1.6.0"
            onChange={(event) => {
              setMta(event.target.value);
              setDirty(true);
              setSaved(false);
            }}
          />
          <div className="space-y-1.5">
            <label htmlFor={`${field}-dependencies`} className={nativeLabelClass}>
              {copy.dependencies}
            </label>
            <textarea
              id={`${field}-dependencies`}
              value={dependencies}
              maxLength={4000}
              rows={8}
              disabled={busy}
              readOnly={product.suspended}
              aria-describedby={`${field}-hint`}
              onChange={(event) => {
                setDependencies(event.target.value);
                setDirty(true);
                setSaved(false);
              }}
              className={textareaClass}
            />
          </div>
          <p id={`${field}-hint`} className="text-xs text-muted">
            {copy.dependencyHint}
          </p>
          {product.suspended ? (
            <ErrorState
              id="resource-compatibility-product-state-changed"
              title={copy.errors.PRODUCT_STATE_CHANGED}
            />
          ) : null}
          <Button type="submit" isLoading={busy} disabled={disabled} className="min-h-11">
            {busy ? copy.working : copy.save}
          </Button>
          {newest && (
            <section
              aria-label={copy.compatibilityLatest}
              className="space-y-2 rounded-lg border border-base p-3 text-sm"
            >
              <p>{copy.compatibilityChanged}</p>
              <p>{copy.compatibilityDraftHelp}</p>
              <p>
                {copy.mta}: {newest.compatibility.mtaMinVersion ?? "—"}
              </p>
              <p className="whitespace-pre-wrap break-words">
                {copy.dependencies}: {(newest.compatibility.dependencies ?? []).join("\n")}
              </p>
              {!newest.suspended && (!needsCheck || checked) && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (!dirty) {
                      setMta(newest.compatibility.mtaMinVersion ?? "");
                      setDependencies((newest.compatibility.dependencies ?? []).join("\n"));
                    }
                    setBase(newest);
                    setChecked(null);
                    setNeedsCheck(false);
                    setError("");
                  }}
                >
                  {copy.compatibilityUseLatest}
                </Button>
              )}
            </section>
          )}
        </>
      )}
      {needsCheck && !foreignActor && (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void checkSaved()}>
          {copy.compatibilityCheck}
        </Button>
      )}
      {error ? <ErrorState title={error} description={copy.actionFailedDescription} /> : null}
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      )}
    </form>
  );
}
