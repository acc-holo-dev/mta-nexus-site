"use client";
import type { ResourceCopyCommand, ResourceCopyPreview } from "@nexus/domain";
import { resourceCopyCommandSchema } from "@nexus/validation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useRef, useState } from "react";
import { privateApiRequest } from "../lib/private-api-request";
import { confirmedResourceCopy } from "../lib/resource-copy-confirmation";
import { resourceCopyCopy, resourceCopyError } from "../lib/resource-copy-i18n";
import { useNexusLocale } from "./locale-context";
import { ResourceCopyMetadataView } from "./resource-copy-metadata";
export function ResourceCopyForm({
  preview,
}: {
  preview: Omit<ResourceCopyPreview, "source"> & {
    source: Omit<ResourceCopyPreview["source"], "updatedAt"> & { updatedAt: string };
  };
}) {
  const { locale } = useNexusLocale(),
    c = resourceCopyCopy(locale),
    router = useRouter(),
    field = useId();
  const request = useRef<ResourceCopyCommand | null>(null),
    lock = useRef(false);
  const [title, setTitle] = useState(preview.source.title),
    [slug, setSlug] = useState(""),
    [busy, setBusy] = useState(false),
    [frozen, setFrozen] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const parsed = resourceCopyCommandSchema.safeParse(
      request.current ?? {
        requestId: crypto.randomUUID(),
        reviewDigest: preview.reviewDigest,
        title,
        slug,
      },
    );
    if (!parsed.success) {
      setError(c.invalid);
      return;
    }
    request.current = parsed.data;
    lock.current = true;
    setBusy(true);
    setFrozen(true);
    setError("");
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(preview.source.id)}/copy`,
        privateApiRequest({ method: "POST", json: parsed.data }),
      );
      const body = await response.json().catch(() => null);
      const targetId = response.ok
        ? confirmedResourceCopy(body, preview.source.id, parsed.data, preview.metadata)
        : null;
      if (!targetId) {
        setError(resourceCopyError(locale, body?.code));
        return;
      }
      router.push(`/workspace/resources/${encodeURIComponent(targetId)}`);
      router.refresh();
    } catch {
      setError(c.retry);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <p role="note" className="text-sm text-secondary">
        {c.notice}
      </p>
      <p>
        {c.source}: {preview.source.title} ·{" "}
        {preview.source.scope === "organization" ? c.organization : c.personal}
      </p>
      <ResourceCopyMetadataView metadata={preview.metadata} locale={locale} />
      <fieldset disabled={busy || frozen} className="nexus-panel grid gap-4 p-5 sm:grid-cols-2">
        <label htmlFor={`${field}-title`}>
          <span className="block">{c.name}</span>
          <input
            id={`${field}-title`}
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-base bg-surface p-2"
          />
        </label>
        <label htmlFor={`${field}-slug`}>
          <span className="block">{c.slug}</span>
          <input
            id={`${field}-slug`}
            required
            minLength={3}
            maxLength={120}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full rounded border border-base bg-surface p-2"
          />
        </label>
      </fieldset>
      {frozen && (
        <p role="note" className="text-sm text-secondary">
          {c.frozen}
        </p>
      )}
      {error && (
        <p role="alert" className="text-warning">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-4">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-accent px-4 py-2 text-background disabled:opacity-50"
        >
          {busy ? c.busy : c.create}
        </button>
        <Link
          href={`/workspace/resources/${encodeURIComponent(preview.source.id)}/copies`}
          className="text-accent underline"
        >
          {c.history}
        </Link>
      </div>
    </form>
  );
}
