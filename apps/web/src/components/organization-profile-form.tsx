"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@nexus/ui";
import type { Locale } from "../lib/i18n";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import {
  organizationCreateSchema,
  organizationUpdateSchema,
  editableOrganizationSchema,
  type EditableOrganization,
} from "../lib/organization-workspace-contract";
import { organizationRequest as platformRequest } from "../lib/organization-workspace-client";
import { platformFieldClass } from "../lib/user-platform-client";

export function OrganizationProfileForm({
  locale,
  actorId,
  initial,
  disabled = false,
  onSave,
  onBusyChange,
}: {
  locale: Locale;
  actorId?: string;
  initial?: EditableOrganization;
  disabled?: boolean;
  onSave?: (value: EditableOrganization) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const copy = getOrganizationCopy(locale);
  const router = useRouter();
  const [fields, setFields] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    logoUrl: initial?.logoUrl ?? "",
    websiteUrl: initial?.websiteUrl ?? "",
    slug: initial?.slug ?? "",
  });
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  function change(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || guard.current) return;
    const { slug, ...profile } = fields;
    const input = initial
      ? organizationUpdateSchema.safeParse({ ...profile, expectedUpdatedAt: initial.updatedAt })
      : organizationCreateSchema.safeParse(fields);
    if (!input.success) {
      setError(copy.invalid);
      return;
    }
    guard.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setSaved(false);
    try {
      const response = await platformRequest(
        initial
          ? `/api/workspace/organizations/${encodeURIComponent(initial.id)}`
          : "/api/workspace/organizations",
        locale,
        initial ? "PATCH" : "POST",
        input.data,
      );
      const parsed = editableOrganizationSchema.safeParse(response.organization);
      if (!parsed.success) throw new Error(copy.unavailable);
      const organization = parsed.data;
      const { expectedUpdatedAt: _version, ...submitted } =
        "expectedUpdatedAt" in input.data ? input.data : { ...input.data, expectedUpdatedAt: "" };
      if (
        Object.entries(submitted).some(
          ([key, value]) => organization[key as keyof EditableOrganization] !== value,
        ) ||
        (!initial && (organization.isVerified || (actorId && organization.ownerId !== actorId))) ||
        (initial &&
          (organization.id !== initial.id ||
            organization.slug !== initial.slug ||
            organization.ownerId !== initial.ownerId ||
            organization.updatedAt === initial.updatedAt))
      )
        throw new Error(copy.unavailable);
      setSaved(true);
      onSave?.(organization);
      if (!initial) router.push(`/workspace/organizations/${encodeURIComponent(organization.id)}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.unavailable);
    } finally {
      guard.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <form onSubmit={submit} className="nexus-panel space-y-4 p-5" aria-busy={busy}>
      <h2 className="font-heading text-primary">{initial ? copy.profile : copy.create}</h2>
      <p className="text-sm text-muted">{initial ? copy.ownerHelp : copy.createHelp}</p>
      <fieldset disabled={busy || disabled} className="space-y-4">
        <label className="block space-y-1 text-sm text-secondary">
          <span>{copy.name}</span>
          <input
            className={platformFieldClass}
            required
            minLength={2}
            maxLength={100}
            value={fields.name}
            onChange={(e) => change("name", e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm text-secondary">
          <span>{copy.slug}</span>
          <input
            className={platformFieldClass}
            required
            minLength={3}
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            readOnly={!!initial}
            value={fields.slug}
            onChange={(e) => change("slug", e.target.value)}
          />
          <span className="block text-xs text-muted">{copy.slugHelp}</span>
        </label>
        <label className="block space-y-1 text-sm text-secondary">
          <span>{copy.descriptionLabel}</span>
          <textarea
            className={platformFieldClass}
            maxLength={4000}
            rows={5}
            value={fields.description}
            onChange={(e) => change("description", e.target.value)}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["logoUrl", "websiteUrl"] as const).map((key) => (
            <label key={key} className="block space-y-1 text-sm text-secondary">
              <span>{key === "logoUrl" ? copy.logo : copy.website}</span>
              <input
                type="url"
                maxLength={2048}
                className={platformFieldClass}
                value={fields[key]}
                onChange={(e) => change(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <Button type="submit" isLoading={busy}>
          {busy ? copy.saving : initial ? copy.save : copy.create}
        </Button>
      </fieldset>
      {initial && (
        <Link
          href={`/organizations/${encodeURIComponent(initial.slug)}`}
          className="inline-block text-sm text-accent underline"
        >
          {copy.publicView}
        </Link>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-accent">
          {copy.saved}
        </p>
      )}
    </form>
  );
}
