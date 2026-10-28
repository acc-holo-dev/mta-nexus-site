"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { editProductDetailsSchema } from "@nexus/validation";
import { useNexusLocale } from "./locale-context";
import { getResourcePublisherCopy } from "../lib/resource-publisher-i18n";
import {
  exceedsBuildFileSizeLimit,
  getSupportedBuildExtension,
} from "../lib/build-file-validation";
import { getResourceSubmissionErrorMessage } from "../lib/publishing-error-message";
import { buildPackageCopy } from "../lib/build-package-i18n";
import { getResourceCommerceCopy, resourceCommerceError } from "../lib/resource-commerce-i18n";
import {
  authorBuildRetireRequest,
  authorBuildUploadRequest,
  authorDetailsMutationRequest,
} from "../lib/author-resource-requests";

import {
  authorResourceDraftKey,
  parseAuthorResourceDraft,
  sameAuthorDetails,
  reconcileAuthorDetails,
  emptyAuthorVersion,
  hasAuthorVersionDraft,
  type AuthorDetailsDraft,
  type AuthorResourceDraft,
} from "../lib/author-resource-draft";
import {
  confirmedAuthorDetails,
  confirmedAuthorBuild,
  confirmedRetiredBuild,
} from "../lib/author-resource-response";

const inputClass =
  "w-full rounded-md border border-base bg-surface px-3 py-2 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
const buttonClass =
  "rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export function AuthorResourceForms({
  product,
  actorId,
  uploadBlocked = false,
}: {
  actorId: string;
  uploadBlocked?: boolean;
  product: {
    id: string;
    title: string;
    shortDescription: string;
    description: string;
    tags: string[];
    updatedAt: string;
  };
}) {
  const { dictionary, locale } = useNexusLocale();
  const copy = dictionary.authorResources;
  const publishing = dictionary.publishing;
  const router = useRouter();
  const fieldId = useId();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [baseline, setBaseline] = useState<AuthorDetailsDraft>(() => ({
    title: product.title,
    shortDescription: product.shortDescription,
    description: product.description,
    tagsText: product.tags.join(", "),
  }));
  const [details, setDetails] = useState(baseline);
  const [versionDraft, setVersionDraft] = useState({ ...emptyAuthorVersion });
  const [baseUpdatedAt, setBaseUpdatedAt] = useState(product.updatedAt);
  const [ready, setReady] = useState(false);
  const [conflict, setConflict] = useState<AuthorResourceDraft | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const detailsDirty = !sameAuthorDetails(details, baseline);
  const dirty = detailsDirty || hasAuthorVersionDraft(versionDraft) || fileSelected;
  const storageKey = authorResourceDraftKey(actorId, product.id);
  const refreshPending = Date.parse(product.updatedAt) > Date.parse(baseUpdatedAt);

  // The page keys this component by actor/resource. A refresh after our own
  // mutation must not reload storage or replace the other form's pending text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Initial recovery only, for this keyed actor/resource instance.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      const draft = parseAuthorResourceDraft(raw, { actorId, productId: product.id });
      if (draft) {
        if (Date.parse(draft.baseUpdatedAt) !== Date.parse(product.updatedAt)) {
          setConflict(draft);
        } else {
          setDetails(draft.details);
          setVersionDraft(draft.version);
          setRecovered(true);
        }
      } else if (raw) sessionStorage.removeItem(storageKey);
    } catch {
      setStorageFailed(true);
    }
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready || conflict) return;
    try {
      if (detailsDirty || hasAuthorVersionDraft(versionDraft)) {
        const draft: AuthorResourceDraft = {
          schemaVersion: 1,
          actorId,
          productId: product.id,
          savedAt: Date.now(),
          baseUpdatedAt,
          details,
          version: versionDraft,
        };
        sessionStorage.setItem(storageKey, JSON.stringify(draft));
      } else sessionStorage.removeItem(storageKey);
      setStorageFailed(false);
    } catch {
      setStorageFailed(true);
    }
  }, [
    ready,
    conflict,
    detailsDirty,
    details,
    versionDraft,
    actorId,
    product.id,
    baseUpdatedAt,
    storageKey,
  ]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!ready) return;
    const currentServer = {
      title: product.title,
      shortDescription: product.shortDescription,
      description: product.description,
      tagsText: product.tags.join(", "),
    };
    const reconciled = reconcileAuthorDetails(
      { baseline, details, baseUpdatedAt },
      { details: currentServer, updatedAt: product.updatedAt },
    );
    if (!reconciled.changed) return;
    if (reconciled.needsChoice && !conflict) {
      // Keep the user's complete draft, including the other form, until they
      // explicitly choose how to resolve the changed server metadata.
      const pendingDraft: AuthorResourceDraft = {
        schemaVersion: 1,
        actorId,
        productId: product.id,
        savedAt: Date.now(),
        baseUpdatedAt,
        details,
        version: versionDraft,
      };
      setConflict(pendingDraft);
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(pendingDraft));
      } catch {
        setStorageFailed(true);
      }
    }
    if (!sameAuthorDetails(currentServer, baseline)) {
      setSaved(false);
      setRecovered(false);
    }
    setBaseline(reconciled.baseline);
    setDetails(reconciled.details);
    setBaseUpdatedAt(reconciled.baseUpdatedAt);
  }, [
    ready,
    product.title,
    product.shortDescription,
    product.description,
    product.tags,
    product.updatedAt,
    baseline,
    details,
    baseUpdatedAt,
    conflict,
    actorId,
    product.id,
    versionDraft,
    storageKey,
  ]);

  function changeDetails(field: keyof AuthorDetailsDraft, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
    setSaved(false);
  }

  function recoverDraft() {
    if (!conflict) return;
    setDetails(conflict.details);
    setVersionDraft(conflict.version);
    setConflict(null);
    setRecovered(true);
    setSaved(false);
    setSubmitted(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadBlocked || saving || !ready || conflict || refreshPending) return;
    const form = new FormData(event.currentTarget);
    const parsed = editProductDetailsSchema.safeParse({
      title: form.get("title"),
      shortDescription: form.get("shortDescription"),
      description: form.get("description"),
      tags: String(form.get("tags") ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
    setSaved(false);
    setError("");
    if (!parsed.success) {
      setError(copy.invalid);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        `/api/products/${product.id}`,
        authorDetailsMutationRequest(parsed.data, baseUpdatedAt, AbortSignal.timeout(15_000)),
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (
          body?.code === "PRODUCT_STATE_CHANGED" ||
          body?.code === "PRODUCT_METADATA_REVISION_REQUIRED"
        ) {
          setError(resourceCommerceError(locale, body.code));
          router.refresh();
          return;
        }
        if (body?.code === "PRODUCT_METADATA_CONFLICT") {
          setError(copy.metadataConflict);
          router.refresh();
          return;
        }
        setError(
          body?.code === "PRODUCT_METADATA_INVALID"
            ? copy.invalid
            : body?.code === "UNAUTHORIZED"
              ? publishing.authenticationRequired
              : body?.code === "NOT_FOUND"
                ? publishing.buildForbidden
                : body?.code === "RATE_LIMIT_EXCEEDED"
                  ? publishing.uploadRateLimited
                  : copy.failed,
        );
        return;
      }
      const confirmed = confirmedAuthorDetails(response.status, body, product.id, parsed.data);
      if (!confirmed) {
        setError(copy.failed);
        return;
      }
      const cleanDetails = {
        title: confirmed.title,
        shortDescription: confirmed.shortDescription,
        description: confirmed.description,
        tagsText: confirmed.tags.join(", "),
      };
      setDetails(cleanDetails);
      setBaseline(cleanDetails);
      setBaseUpdatedAt(confirmed.updatedAt);
      setSaved(true);
      setRecovered(false);
      router.refresh();
    } catch {
      setError(copy.failed);
    } finally {
      setSaving(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploadBlocked || uploading || !ready || conflict || refreshPending) return;
    const element = event.currentTarget;
    const data = new FormData(element);
    const file = data.get("file");
    setUploadError("");
    setSubmitted(false);
    if (!(file instanceof File) || !file.size || !getSupportedBuildExtension(file.name)) {
      setUploadError(publishing.buildFileTypeNotAllowed);
      return;
    }
    if (exceedsBuildFileSizeLimit(file.size)) {
      setUploadError(publishing.buildFileTooLarge.replace("{maxFileSize}", "64"));
      return;
    }
    setUploading(true);
    try {
      const response = await fetch(
        `/api/products/${product.id}/builds`,
        authorBuildUploadRequest(data, AbortSignal.timeout(120_000)),
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setUploadError(
          body?.code === "PRODUCT_STATE_CHANGED"
            ? resourceCommerceError(locale, body.code)
            : (getResourceSubmissionErrorMessage(body?.code, {
                packageInvalid: buildPackageCopy(locale).invalid,
                packageUnsupported: buildPackageCopy(locale).unsupported,
                packageUnsafePath: buildPackageCopy(locale).path,
                packageLimitExceeded: buildPackageCopy(locale).limit,
                packageInspectorBusy: buildPackageCopy(locale).busy,
                fileTooLarge: publishing.buildFileTooLarge.replace("{maxFileSize}", "64"),
                malwareDetected: publishing.scannerMalwareDetected,
                scanLimitExceeded: publishing.scannerLimitExceeded,
                scannerUnavailable: publishing.scannerUnavailable,
                authenticationRequired: publishing.authenticationRequired,
                uploadRateLimited: publishing.uploadRateLimited,
                resourceNotFound: publishing.resourceNotFound,
                buildForbidden: publishing.buildForbidden,
                versionAlreadyExists: publishing.versionAlreadyExists,
                metadataInvalid: publishing.metadataInvalid,
                buildFileTypeNotAllowed: publishing.buildFileTypeNotAllowed,
                buildContentMismatch: publishing.buildContentMismatch,
                buildFileNameInvalid: publishing.buildFileNameInvalid,
                paidPublishingUnavailable: publishing.paidPublishingUnavailable,
              }) ?? copy.uploadFailed),
        );
        return;
      }
      if (
        !confirmedAuthorBuild(response.status, body, product.id, String(data.get("version") ?? ""))
      ) {
        setUploadError(copy.uploadFailed);
        return;
      }
      element.reset();
      setVersionDraft({ ...emptyAuthorVersion });
      setFileSelected(false);
      setRecovered(false);
      setSubmitted(true);
      router.refresh();
    } catch {
      setUploadError(copy.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="space-y-2 lg:col-span-2">
        {conflict && (
          <div role="alert" className="space-y-3 rounded-lg border border-base bg-surface p-4">
            <p>{copy.draftConflict}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={recoverDraft} className={buttonClass}>
                {copy.restoreDraft}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDetails(baseline);
                  setConflict(null);
                  setRecovered(false);
                  setSaved(false);
                }}
                className="rounded-md border border-base px-4 py-2"
              >
                {copy.discardDraft}
              </button>
            </div>
          </div>
        )}
        {recovered && (
          <p role="status" className="text-sm text-secondary">
            {copy.draftRestored}
          </p>
        )}
        {dirty && (
          <p role="status" className="text-sm text-secondary">
            {copy.unsaved}
          </p>
        )}
        {storageFailed && (
          <p role="alert" className="text-sm text-error">
            {copy.draftUnavailable}
          </p>
        )}
        {(fileSelected || hasAuthorVersionDraft(versionDraft)) && (
          <p className="text-sm text-muted">{copy.fileReselect}</p>
        )}
      </div>
      <form
        onSubmit={save}
        aria-label={copy.edit}
        className="space-y-4 rounded-lg border border-base bg-surface p-5"
      >
        <h2 className="text-xl font-semibold text-primary">{copy.edit}</h2>
        <p className="text-sm text-secondary">
          {uploadBlocked
            ? getResourcePublisherCopy(locale).readonly
            : getResourcePublisherCopy(locale).editNote}
        </p>
        <fieldset
          disabled={uploadBlocked || saving || !ready || Boolean(conflict) || refreshPending}
          className="space-y-4"
        >
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.title}</span>
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              value={details.title}
              onChange={(event) => changeDetails("title", event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.shortDescription}</span>
            <input
              name="shortDescription"
              maxLength={250}
              value={details.shortDescription}
              onChange={(event) => changeDetails("shortDescription", event.target.value)}
              className={inputClass}
            />
          </label>
          <div className="block space-y-1 text-sm text-secondary">
            <label htmlFor={`${fieldId}-description`}>{publishing.description}</label>
            <textarea
              id={`${fieldId}-description`}
              name="description"
              required
              minLength={10}
              maxLength={10000}
              rows={6}
              value={details.description}
              onChange={(event) => changeDetails("description", event.target.value)}
              className={inputClass}
            />
          </div>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.tags}</span>
            <input
              name="tags"
              value={details.tagsText}
              maxLength={4096}
              onChange={(event) => changeDetails("tagsText", event.target.value)}
              className={inputClass}
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}
        {saved && !refreshPending && !conflict && (
          <p role="status" className="text-sm text-success">
            {copy.saved}
          </p>
        )}
        <button
          type="submit"
          disabled={uploadBlocked || saving || !ready || Boolean(conflict) || refreshPending}
          className={buttonClass}
        >
          {saving ? copy.saving : copy.save}
        </button>
      </form>
      <form
        onSubmit={upload}
        aria-label={copy.newVersion}
        className="space-y-4 rounded-lg border border-base bg-surface p-5"
      >
        <h2 className="text-xl font-semibold text-primary">{copy.newVersion}</h2>
        <p className="text-sm text-secondary">
          {uploadBlocked
            ? getResourceCommerceCopy(locale).errors.PRODUCT_STATE_CHANGED
            : publishing.submittedDescription}
        </p>
        <fieldset
          disabled={uploadBlocked || uploading || !ready || Boolean(conflict) || refreshPending}
          className="space-y-4"
        >
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.version}</span>
            <input
              name="version"
              value={versionDraft.version}
              onChange={(event) => {
                setVersionDraft((draft) => ({ ...draft, version: event.target.value }));
                setSubmitted(false);
              }}
              required
              maxLength={64}
              placeholder="1.1.0"
              pattern="v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.minMtaVersion}</span>
            <input
              name="mtaVersionTarget"
              value={versionDraft.mtaVersionTarget}
              onChange={(event) => {
                setVersionDraft((draft) => ({ ...draft, mtaVersionTarget: event.target.value }));
                setSubmitted(false);
              }}
              maxLength={64}
              placeholder="1.6.0"
              className={inputClass}
            />
          </label>
          <div className="block space-y-1 text-sm text-secondary">
            <label htmlFor={`${fieldId}-release-notes`}>{publishing.releaseNotes}</label>
            <textarea
              id={`${fieldId}-release-notes`}
              name="releaseNotes"
              value={versionDraft.releaseNotes}
              onChange={(event) => {
                setVersionDraft((draft) => ({ ...draft, releaseNotes: event.target.value }));
                setSubmitted(false);
              }}
              maxLength={5000}
              rows={4}
              className={inputClass}
            />
          </div>
          <label className="block space-y-1 text-sm text-secondary">
            <span>{publishing.buildArchive}</span>
            <input
              name="file"
              type="file"
              onChange={(event) => {
                setFileSelected(Boolean(event.target.files?.length));
                setSubmitted(false);
              }}
              required
              accept=".zip,.rar,.7z,.lua"
              className={inputClass}
            />
            <span className="block text-xs text-muted">
              {publishing.buildFileRequirements.replace("{maxFileSize}", "64")}
            </span>
          </label>
        </fieldset>
        {uploadError && (
          <p role="alert" className="text-sm text-error">
            {uploadError}
          </p>
        )}
        {submitted && (
          <p role="status" className="text-sm text-success">
            {copy.versionSubmitted}
          </p>
        )}
        <button
          type="submit"
          disabled={uploadBlocked || uploading || !ready || Boolean(conflict) || refreshPending}
          className={buttonClass}
        >
          {uploading ? publishing.submitting : copy.newVersion}
        </button>
      </form>
    </div>
  );
}

export function RetireBuildForm({
  productId,
  buildId,
  version,
  revision,
}: {
  productId: string;
  buildId: string;
  version: string;
  revision: number;
}) {
  const { dictionary } = useNexusLocale();
  const copy = dictionary.authorResources;
  const router = useRouter();
  const reasonId = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function retire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "").trim();
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/products/${productId}/builds/${buildId}`,
        authorBuildRetireRequest(reason, revision, AbortSignal.timeout(15_000)),
      );
      const body = await response.json().catch(() => null);
      if (!confirmedRetiredBuild(response.status, body, productId, buildId)) {
        setError(copy.retireFailed);
        return;
      }
      router.refresh();
    } catch {
      setError(copy.retireFailed);
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="text-sm text-secondary">
      <summary className="cursor-pointer">
        {copy.retire} · {version}
      </summary>
      <form onSubmit={retire} className="mt-3 space-y-3">
        <p>{copy.retireHint}</p>
        <div className="block space-y-1">
          <label htmlFor={reasonId}>{copy.retireReason}</label>
          <textarea
            id={reasonId}
            name="reason"
            required
            minLength={3}
            maxLength={2000}
            disabled={pending}
            className={inputClass}
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? copy.retiring : copy.retire}
        </button>
      </form>
    </details>
  );
}
