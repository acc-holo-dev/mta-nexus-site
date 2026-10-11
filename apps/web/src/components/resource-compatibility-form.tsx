"use client";
import type { Product } from "@nexus/domain";
import { resourceCompatibilitySchema } from "@nexus/validation";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedCompatibility } from "../lib/resource-management-confirmation";
import {
  getResourceManagementCopy,
  resourceManagementError,
} from "../lib/resource-management-i18n";
import { useNexusLocale } from "./locale-context";
import { getResourcePublisherCopy } from "../lib/resource-publisher-i18n";

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
    <form onSubmit={submit} className="nexus-panel space-y-4 p-5">
      <p className="text-sm text-secondary">{copy.compatibilityNote}</p>
      <p className="text-sm text-secondary">
        {product.suspended
          ? getResourcePublisherCopy(locale).readonly
          : getResourcePublisherCopy(locale).editNote}
      </p>
      <label htmlFor={`${field}-mta`} className="block text-sm text-secondary">
        {copy.mta}
      </label>
      <input
        id={`${field}-mta`}
        value={mta}
        maxLength={64}
        disabled={disabled}
        placeholder="1.6.0"
        onChange={(event) => setMta(event.target.value)}
        className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-primary"
      />
      <label htmlFor={`${field}-dependencies`} className="block text-sm text-secondary">
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
        className="w-full rounded-lg border border-base bg-surface px-3 py-2 font-mono text-primary"
      />
      <p id={`${field}-hint`} className="text-xs text-muted">
        {copy.dependencyHint}
      </p>
      {product.suspended && <p className="text-warning">{copy.errors.PRODUCT_STATE_CHANGED}</p>}
      <button
        disabled={disabled}
        type="submit"
        className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? copy.working : copy.save}
      </button>
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
