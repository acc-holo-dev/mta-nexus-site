"use client";
import { canManageOrganization } from "@nexus/domain";
import { Button, ErrorState, Input } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { Locale } from "../lib/i18n";
import { organizationRequest as platformRequest } from "../lib/organization-workspace-client";
import {
  type EditableOrganization,
  editableOrganizationSchema,
  organizationCreateSchema,
  organizationUpdateSchema,
  organizationWorkspaceSchema,
} from "../lib/organization-workspace-contract";
import { getOrganizationCopy } from "../lib/organization-workspace-copy";
import { parseEditableProfile } from "../lib/user-platform-client";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";

export function OrganizationProfileForm({
  locale,
  actorId,
  initial,
  disabled = false,
  canEdit = true,
  onSave,
  onBusyChange,
}: {
  locale: Locale;
  actorId?: string;
  initial?: EditableOrganization;
  disabled?: boolean;
  canEdit?: boolean;
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
  const [base, setBase] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [checked, setChecked] = useState<EditableOrganization | null>(null);
  const [needsCheck, setNeedsCheck] = useState(false);
  const [identityVerified, setIdentityVerified] = useState(true);
  const [restrictedVerified, setRestrictedVerified] = useState(false);
  const [serverPermits, setServerPermits] = useState(true);
  const newest =
    initial && checked && Date.parse(initial.updatedAt) > Date.parse(checked.updatedAt)
      ? initial
      : (checked ?? initial);
  const changed = Boolean(
    base && newest && Date.parse(newest.updatedAt) > Date.parse(base.updatedAt),
  );
  const showDraft = !dirty || (identityVerified && (canEdit || restrictedVerified));
  useEffect(() => {
    if (canEdit) setRestrictedVerified(false);
  }, [canEdit]);
  function change(key: keyof typeof fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      disabled ||
      guard.current ||
      !identityVerified ||
      !serverPermits ||
      needsCheck ||
      changed ||
      checked
    )
      return;
    const { slug, ...profile } = fields;
    const input = base
      ? organizationUpdateSchema.safeParse({ ...profile, expectedUpdatedAt: base.updatedAt })
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
        base
          ? `/api/workspace/organizations/${encodeURIComponent(base.id)}`
          : "/api/workspace/organizations",
        locale,
        base ? "PATCH" : "POST",
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
        (!base && (organization.isVerified || (actorId && organization.ownerId !== actorId))) ||
        (base &&
          (organization.id !== base.id ||
            organization.slug !== base.slug ||
            organization.ownerId !== base.ownerId ||
            Date.parse(organization.updatedAt) <= Date.parse(base.updatedAt)))
      )
        throw new Error(copy.unavailable);
      setSaved(true);
      setBase(organization);
      setDirty(false);
      setChecked(null);
      setNeedsCheck(false);
      onSave?.(organization);
      if (!initial) router.push(`/workspace/organizations/${encodeURIComponent(organization.id)}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : copy.unavailable);
      if (base) setNeedsCheck(true);
    } finally {
      guard.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  async function checkSavedProfile() {
    if (!base || !actorId || guard.current) return;
    guard.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setIdentityVerified(false);
    setRestrictedVerified(false);
    setServerPermits(false);
    setChecked(null);
    try {
      const identity = parseEditableProfile(
        (await platformRequest("/api/account/profile", locale)).profile,
      );
      if (!identity) throw new Error(copy.unavailable);
      if (identity.id !== actorId) {
        setFields({
          name: base.name,
          description: base.description,
          logoUrl: base.logoUrl,
          websiteUrl: base.websiteUrl,
          slug: base.slug,
        });
        setDirty(false);
        setError(copy.profileActorChanged);
        return;
      }
      setIdentityVerified(true);
      setRestrictedVerified(true);
      const result = organizationWorkspaceSchema.safeParse(
        await platformRequest(
          `/api/workspace/organizations/${encodeURIComponent(base.id)}`,
          locale,
        ),
      );
      if (
        !result.success ||
        result.data.organization.id !== base.id ||
        result.data.organization.slug !== base.slug ||
        Date.parse(result.data.organization.updatedAt) < Date.parse(base.updatedAt)
      )
        throw new Error(copy.unavailable);
      setServerPermits(canManageOrganization(result.data.role));
      setChecked(result.data.organization);
      setError("");
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
      {showDraft ? (
        <fieldset
          disabled={busy || (disabled && canEdit) || !identityVerified}
          className="space-y-4"
        >
          <Input
            id="organization-name"
            label={copy.name}
            required
            minLength={2}
            maxLength={100}
            value={fields.name}
            readOnly={!canEdit}
            onChange={(e) => change("name", e.target.value)}
          />
          <div className="space-y-1.5">
            <Input
              id="organization-slug"
              label={copy.slug}
              required
              minLength={3}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              readOnly={!!initial || !canEdit}
              value={fields.slug}
              onChange={(e) => change("slug", e.target.value)}
              aria-describedby="organization-slug-help"
            />
            <span id="organization-slug-help" className="block text-xs text-muted">
              {copy.slugHelp}
            </span>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="organization-description" className={nativeLabelClass}>
              {copy.descriptionLabel}
            </label>
            <textarea
              id="organization-description"
              maxLength={4000}
              rows={5}
              value={fields.description}
              readOnly={!canEdit}
              onChange={(e) => change("description", e.target.value)}
              className={textareaClass}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["logoUrl", "websiteUrl"] as const).map((key) => (
              <Input
                key={key}
                id={`organization-${key}`}
                type="url"
                label={key === "logoUrl" ? copy.logo : copy.website}
                maxLength={2048}
                value={fields[key]}
                readOnly={!canEdit}
                onChange={(e) => change(key, e.target.value)}
              />
            ))}
          </div>
          <Button
            type="submit"
            isLoading={busy}
            disabled={!canEdit || !serverPermits || needsCheck || changed || Boolean(checked)}
            className="min-h-11"
          >
            {busy ? copy.saving : initial ? copy.save : copy.create}
          </Button>
        </fieldset>
      ) : (
        <p className="text-sm text-muted">{copy.profileVerify}</p>
      )}
      {base && (!canEdit || needsCheck || !identityVerified || !serverPermits) && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void checkSavedProfile()}
        >
          {showDraft ? copy.profileCheck : copy.profileVerify}
        </Button>
      )}
      {showDraft && identityVerified && newest && (changed || checked) && (
        <section
          className="space-y-2 rounded-lg border border-base p-4"
          aria-label={copy.profileLatest}
        >
          <p>{copy.profileChanged}</p>
          <p className="text-sm text-muted">{copy.profileDraftHelp}</p>
          <p>
            {copy.name}: {newest.name}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {copy.descriptionLabel}: {newest.description}
          </p>
          <p className="break-words">
            {copy.logo}: {newest.logoUrl}
          </p>
          <p className="break-words">
            {copy.website}: {newest.websiteUrl}
          </p>
          {canEdit && serverPermits && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (!dirty) {
                  setFields({
                    name: newest.name,
                    description: newest.description,
                    logoUrl: newest.logoUrl,
                    websiteUrl: newest.websiteUrl,
                    slug: newest.slug,
                  });
                }
                setBase(newest);
                setChecked(null);
                setNeedsCheck(false);
                setError("");
              }}
            >
              {copy.profileUseLatest}
            </Button>
          )}
        </section>
      )}
      {initial && (
        <Link
          href={`/organizations/${encodeURIComponent(initial.slug)}`}
          className="inline-flex min-h-11 items-center text-sm text-accent underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.publicView}
        </Link>
      )}
      {error && <ErrorState title={error} />}
      {saved && (
        <p
          role="status"
          className="text-sm text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nexus-accent)]"
        >
          {copy.saved}
        </p>
      )}
    </form>
  );
}
