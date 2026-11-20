"use client";
import { canManageOrganization } from "@nexus/domain";
import { Button, ErrorState, Input } from "@nexus/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { getDictionary, type Locale } from "../../../lib/i18n";
import { PlatformRequestError, parseEditableProfile } from "../../community/user-platform-client";
import { getUserPlatformCopy } from "../../community/user-platform-copy";
import { linkAccentSm, linkAccentTightSmPlain } from "../../shell/link-shell";
import { panelSpace4P5 } from "../../shell/panel-shell";
import { surfaceSpace2P4 } from "../../shell/surface-shell";
import {
  typeGrid2Gap4,
  typeHeadingPrimary,
  typeLabelBlockUpperSecondary,
  typePrewrapBreak,
  typeSmMuted,
} from "../../shell/type-shell";
import { organizationRequest as platformRequest } from "../organization-workspace-client";
import {
  type EditableOrganization,
  editableOrganizationSchema,
  organizationCreateSchema,
  organizationUpdateSchema,
  organizationWorkspaceSchema,
} from "../organization-workspace-contract";
import { getOrganizationCopy } from "../organization-workspace-copy";

const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
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
  function safeMessage(failure: unknown, fallback: string) {
    const text = failure instanceof Error ? failure.message : "";
    return [...Object.values(copy), ...Object.values(getUserPlatformCopy(locale))].includes(text)
      ? text
      : fallback;
  }
  const formErrorHint = getDictionary(locale).errors.formErrorHint;
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
  const [creationReady, setCreationReady] = useState(Boolean(initial));
  const [verifiedCreationKey, setVerifiedCreationKey] = useState("");
  const [creationNonce, setCreationNonce] = useState<string | null>(null);
  const [creationNotice, setCreationNotice] = useState("");
  const creationKey = `nexus:organization-create:v1:${actorId ?? ""}`;
  const currentCreationKey = useRef(creationKey);
  const identityEpoch = useRef(0);
  if (currentCreationKey.current !== creationKey) identityEpoch.current += 1;
  currentCreationKey.current = creationKey;
  const localeRef = useRef(locale);
  localeRef.current = locale;
  useEffect(() => {
    if (initial) return;
    let alive = true;
    setCreationReady(false);
    setCreationNonce(null);
    setVerifiedCreationKey("");
    setFields({ name: "", description: "", logoUrl: "", websiteUrl: "", slug: "" });
    setDirty(false);
    setError("");
    setCreationNotice("");
    async function restore() {
      try {
        if (!actorId) throw new Error("identity");
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const session = await response.json();
        if (!response.ok || session?.authenticated !== true || session?.user?.id !== actorId)
          throw new Error("identity");
        const raw = sessionStorage.getItem(creationKey);
        if (raw) {
          if (raw.length > 20_000) throw new Error("storage");
          const item = JSON.parse(raw);
          const parsed = organizationCreateSchema.safeParse(item.fields);
          if (item.actorId !== actorId || !/^[a-f0-9]{32}$/u.test(item.nonce) || !parsed.success)
            throw new Error("storage");
          if (alive) {
            setFields(parsed.data);
            setCreationNonce(item.nonce);
          }
        }
        if (alive) {
          setVerifiedCreationKey(creationKey);
          setCreationReady(true);
        }
      } catch {
        if (alive) setCreationNotice(getOrganizationCopy(localeRef.current).restoreFailed);
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [actorId, creationKey, initial]);

  async function recoverCreation() {
    if (!actorId || !creationNonce || guard.current || verifiedCreationKey !== creationKey) return;
    guard.current = true;
    setBusy(true);
    const requestEpoch = identityEpoch.current;
    try {
      const response = await platformRequest(
        `/api/workspace/organizations/recovery?nonce=${creationNonce}`,
        locale,
        "GET",
        undefined,
        undefined,
        { "x-nexus-actor-id": actorId },
      );
      if (identityEpoch.current !== requestEpoch) return;
      const item = response.organization;
      if (
        item &&
        typeof item === "object" &&
        "id" in item &&
        typeof item.id === "string" &&
        /^[A-Za-z0-9_-]{1,128}$/u.test(item.id)
      ) {
        try {
          sessionStorage.removeItem(creationKey);
        } catch {
          /* Safe to navigate after confirmed success. */
        }
        router.push(`/workspace/organizations/${encodeURIComponent(item.id)}`);
        return;
      }
      setCreationNotice(copy.creationUnconfirmed);
    } catch {
      if (identityEpoch.current !== requestEpoch) return;
      setCreationNotice(copy.resultCheckFailed);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
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
      checked ||
      (!base && (!creationReady || verifiedCreationKey !== creationKey || Boolean(creationNonce)))
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
    const requestEpoch = identityEpoch.current;
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    setSaved(false);
    try {
      let nonce: string | undefined;
      if (!base) {
        if (!actorId) throw new Error(copy.unavailable);
        nonce = crypto.randomUUID().replaceAll("-", "");
        sessionStorage.setItem(creationKey, JSON.stringify({ actorId, nonce, fields: input.data }));
        setCreationNonce(nonce);
      }
      const response = await platformRequest(
        base
          ? `/api/workspace/organizations/${encodeURIComponent(base.id)}`
          : "/api/workspace/organizations",
        locale,
        base ? "PATCH" : "POST",
        input.data,
        undefined,
        actorId
          ? { "x-nexus-actor-id": actorId, ...(nonce ? { "x-nexus-creation-nonce": nonce } : {}) }
          : undefined,
      );
      if (!base && identityEpoch.current !== requestEpoch) return;
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
      if (!base) {
        try {
          sessionStorage.removeItem(creationKey);
        } catch {
          /* The result is confirmed. */
        }
      }
      setBase(organization);
      setDirty(false);
      setChecked(null);
      setNeedsCheck(false);
      onSave?.(organization);
      if (!initial) router.push(`/workspace/organizations/${encodeURIComponent(organization.id)}`);
      router.refresh();
    } catch (caught) {
      if (!base && identityEpoch.current !== requestEpoch) return;
      if (
        !base &&
        caught instanceof PlatformRequestError &&
        [
          "VALIDATION_ERROR",
          "ACTOR_CHANGED",
          "ACTOR_ID_REQUIRED",
          "UNAUTHORIZED",
          "FORBIDDEN",
          "SLUG_CONFLICT",
          "REQUEST_BODY_TOO_LARGE",
          "UNSUPPORTED_MEDIA_TYPE",
          "RATE_LIMIT_EXCEEDED",
          "RATE_LIMITED",
        ].includes(String(caught.code))
      ) {
        try {
          sessionStorage.removeItem(creationKey);
          setCreationNonce(null);
        } catch {
          /* Keep recovery locked if storage is unavailable. */
        }
      }
      setError(safeMessage(caught, copy.unavailable));
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
          "GET",
          undefined,
          undefined,
          { "x-nexus-actor-id": actorId },
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
      setError(safeMessage(caught, copy.unavailable));
    } finally {
      guard.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <form onSubmit={submit} className={panelSpace4P5} aria-busy={busy}>
      <h2 className={typeHeadingPrimary}>{initial ? copy.profile : copy.create}</h2>
      <p className={typeSmMuted}>{initial ? copy.ownerHelp : copy.createHelp}</p>
      {creationNotice && !initial && (!creationReady || verifiedCreationKey === creationKey) ? (
        <ErrorState title={creationNotice} description={formErrorHint} />
      ) : null}
      {creationNonce && !initial && verifiedCreationKey === creationKey ? (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void recoverCreation()}
        >
          {copy.checkResult}
        </Button>
      ) : null}
      {showDraft && (Boolean(initial) || (creationReady && verifiedCreationKey === creationKey)) ? (
        <fieldset
          disabled={
            busy ||
            (disabled && canEdit) ||
            !identityVerified ||
            (!initial && Boolean(creationNonce))
          }
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
            <label htmlFor="organization-description" className={typeLabelBlockUpperSecondary}>
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
          <div className={typeGrid2Gap4}>
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
        <p className={typeSmMuted}>{copy.profileVerify}</p>
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
        <section className={surfaceSpace2P4} aria-label={copy.profileLatest}>
          <p>{copy.profileChanged}</p>
          <p className={typeSmMuted}>{copy.profileDraftHelp}</p>
          <p>
            {copy.name}: {newest.name}
          </p>
          <p className={typePrewrapBreak}>
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
        <Link href={`/organizations/${encodeURIComponent(initial.slug)}`} className={linkAccentSm}>
          {copy.publicView}
        </Link>
      )}
      {error && <ErrorState title={error} description={formErrorHint} />}
      {saved && (
        <p role="status" className={linkAccentTightSmPlain}>
          {copy.saved}
        </p>
      )}
    </form>
  );
}
