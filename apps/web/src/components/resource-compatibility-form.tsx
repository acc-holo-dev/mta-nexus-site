"use client";
import type { Product } from "@nexus/domain";
import { Button, Input } from "@nexus/ui";
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
import { useNexusLocale } from "./locale-context";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 font-mono text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

export function ResourceCompatibilityForm({
  product,
}: {
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
  const disabled = busy || saved || product.suspended;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled) return;
    const parsed = resourceCompatibilitySchema.safeParse({
      expectedUpdatedAt: product.updatedAt,
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
      const response = await fetch(
        `/api/products/${product.id}/compatibility`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const body = await response.json().catch(() => null);
      if (
        !response.ok ||
        !confirmedCompatibility(body, product.id, product.updatedAt, parsed.data.compatibility)
      ) {
        setError(resourceManagementError(locale, body?.code));
        if (response.status === 409) router.refresh();
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError(copy.errors.fallback);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} aria-busy={busy} className="nexus-panel space-y-4 p-5">
      <p className="text-sm text-secondary">{copy.compatibilityNote}</p>
      <p className="text-sm text-secondary">
        {product.suspended
          ? getResourcePublisherCopy(locale).readonly
          : getResourcePublisherCopy(locale).editNote}
      </p>
      <Input
        id={`${field}-mta`}
        label={copy.mta}
        value={mta}
        maxLength={64}
        disabled={disabled}
        placeholder="1.6.0"
        onChange={(event) => setMta(event.target.value)}
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
          disabled={disabled}
          aria-describedby={`${field}-hint`}
          onChange={(event) => setDependencies(event.target.value)}
          className={textareaClass}
        />
      </div>
      <p id={`${field}-hint`} className="text-xs text-muted">
        {copy.dependencyHint}
      </p>
      {product.suspended && <p className="text-warning">{copy.errors.PRODUCT_STATE_CHANGED}</p>}
      <Button type="submit" isLoading={busy} disabled={disabled} className="min-h-11">
        {busy ? copy.working : copy.save}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-success">
          {copy.saved}
        </p>
      )}
    </form>
  );
}
