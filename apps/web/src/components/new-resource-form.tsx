"use client";

import { PRODUCT_TYPES } from "@nexus/domain";
import { Button } from "@nexus/ui";
import { type FormEvent, useEffect, useState } from "react";
import { confirmedAuthorBuild } from "../lib/author-resource-response";
import {
  MAX_BUILD_FILE_SIZE_BYTES,
  validateBuildFileSelection,
} from "../lib/build-file-validation";
import { confirmedCreatedResource } from "../lib/new-resource-response";
import {
  createPendingResourceDraft,
  PENDING_RESOURCE_DRAFT_KEY,
  parsePendingResourceDraft,
  pendingResourceDraftKey,
} from "../lib/pending-resource-draft";
import { PRODUCT_PUBLISHING_KEYS } from "../lib/product-type-labels";
import { getResourceSubmissionErrorMessage } from "../lib/publishing-error-message";
import { buildPackageCopy } from "../lib/build-package-i18n";
import { useNexusLocale } from "./locale-context";
import { ResourceSubmissionSuccess } from "./resource-submission-success";
import { MtaMetaInspectorPanel } from "./mta-meta-inspector-panel";

const fieldClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary outline-none transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)]";
const labelClass = "space-y-1.5";
const labelTextClass = "font-label text-secondary";

export function NewResourceForm({ actorId }: { actorId: string }) {
  const storageKey = pendingResourceDraftKey(actorId);
  const { locale, dictionary } = useNexusLocale();
  const copy = dictionary.publishing;
  const maxFileSizeMb = String(MAX_BUILD_FILE_SIZE_BYTES / (1024 * 1024));
  const buildFileTooLarge = copy.buildFileTooLarge.replace("{maxFileSize}", maxFileSizeMb);
  const buildFileRequirements = copy.buildFileRequirements.replace("{maxFileSize}", maxFileSizeMb);
  const publishingErrorMessages = {
    packageInvalid: buildPackageCopy(locale).invalid,
    packageUnsupported: buildPackageCopy(locale).unsupported,
    packageUnsafePath: buildPackageCopy(locale).path,
    packageLimitExceeded: buildPackageCopy(locale).limit,
    packageInspectorBusy: buildPackageCopy(locale).busy,
    fileTooLarge: buildFileTooLarge,
    malwareDetected: copy.scannerMalwareDetected,
    scanLimitExceeded: copy.scannerLimitExceeded,
    scannerUnavailable: copy.scannerUnavailable,
    authenticationRequired: copy.authenticationRequired,
    uploadRateLimited: copy.uploadRateLimited,
    resourceNotFound: copy.resourceNotFound,
    buildForbidden: copy.buildForbidden,
    paidPublishingUnavailable: copy.paidPublishingUnavailable,
    versionAlreadyExists: copy.versionAlreadyExists,
    multipartRequired: copy.multipartRequired,
    multipartInvalid: copy.multipartInvalid,
    metadataInvalid: copy.metadataInvalid,
    buildFileTypeNotAllowed: copy.buildFileTypeNotAllowed,
    buildContentMismatch: copy.buildContentMismatch,
    buildFileNameInvalid: copy.buildFileNameInvalid,
    resourceMetadataInvalid: copy.resourceMetadataInvalid,
    resourceSlugAlreadyExists: copy.resourceSlugAlreadyExists,
    resourceCreationFailed: copy.resourceCreationFailed,
  };
  const [loading, setLoading] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [createdProduct, setCreatedProduct] = useState<{
    id: string;
    slug: string;
    mtaVersionTarget: string;
  } | null>(null);
  const [formEpoch, setFormEpoch] = useState(0);
  const [mtaVersionTarget, setMtaVersionTarget] = useState("1.6.0");
  const [draftReady, setDraftReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNewSubmission() {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // The in-memory state still resets if storage is unavailable.
    }
    setCreatedProduct(null);
    setMtaVersionTarget("1.6.0");
    setError(null);
    setFormEpoch((current) => current + 1);
  }

  useEffect(() => {
    try {
      sessionStorage.removeItem(PENDING_RESOURCE_DRAFT_KEY);
      const stored = sessionStorage.getItem(storageKey);
      const pendingDraft = parsePendingResourceDraft(stored, actorId);
      if (pendingDraft) {
        setCreatedProduct(pendingDraft);
        setMtaVersionTarget(pendingDraft.mtaVersionTarget);
      } else if (stored) {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    } finally {
      setDraftReady(true);
    }
  }, [actorId, storageKey]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftReady || loading) return;

    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const fileEntry = form.get("file");
      const file = fileEntry instanceof File ? fileEntry : null;
      const fileIssue = validateBuildFileSelection(file);
      if (fileIssue === "missing") {
        throw new Error(copy.chooseArchive);
      }
      if (fileIssue === "too_large") {
        throw new Error(buildFileTooLarge);
      }
      if (fileIssue === "unsupported_type") {
        throw new Error(copy.buildFileTypeNotAllowed);
      }
      if (!file) {
        throw new Error(copy.chooseArchive);
      }

      let product = createdProduct;
      if (!product) {
        const mtaVersionTarget = String(form.get("mtaMinVersion") || "").trim();
        const createRequest = {
          title: String(form.get("title") || "").trim(),
          slug: String(form.get("slug") || "")
            .trim()
            .toLowerCase(),
          shortDescription: String(form.get("shortDescription") || "").trim(),
          description: String(form.get("description") || "").trim(),
          type: String(form.get("type") || "script"),
          price: 0,
          currency: "USD",
          licenseModel: "unlimited",
          tags: String(form.get("tags") || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          compatibility: {
            mtaMinVersion: mtaVersionTarget || undefined,
            dependencies: String(form.get("dependencies") || "")
              .split(",")
              .map((dependency) => dependency.trim().toLowerCase())
              .filter(Boolean),
          },
        };
        const productResponse = await fetch("/api/products", {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createRequest),
          signal: AbortSignal.timeout(15_000),
        });
        const productData = await productResponse.json().catch(() => null);
        const productErrorMessage = getResourceSubmissionErrorMessage(
          productData?.code,
          publishingErrorMessages,
        );
        const confirmed = confirmedCreatedResource(
          productResponse.status,
          productData,
          actorId,
          createRequest,
        );
        if (!confirmed) {
          throw new Error(productErrorMessage || productData?.error || copy.createError);
        }
        product = {
          id: confirmed.id,
          slug: confirmed.slug,
          mtaVersionTarget,
        };
        setCreatedProduct(product);
        try {
          sessionStorage.setItem(
            storageKey,
            JSON.stringify(createPendingResourceDraft(product, actorId)),
          );
        } catch {
          // Keep the in-memory retry path if session storage is unavailable.
        }
      }

      const buildForm = new FormData();
      buildForm.set("version", String(form.get("version") || "1.0.0").trim());
      buildForm.set("releaseNotes", String(form.get("releaseNotes") || "").trim());
      buildForm.set("mtaVersionTarget", product.mtaVersionTarget);
      buildForm.set("file", file);

      const buildResponse = await fetch(`/api/products/${encodeURIComponent(product.id)}/builds`, {
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
        body: buildForm,
        signal: AbortSignal.timeout(60_000),
      });
      const buildData = await buildResponse.json().catch(() => null);
      if (
        !confirmedAuthorBuild(
          buildResponse.status,
          buildData,
          product.id,
          String(form.get("version") || "1.0.0"),
        )
      ) {
        const publishingMessage = getResourceSubmissionErrorMessage(
          buildData?.code,
          publishingErrorMessages,
        );
        throw new Error(publishingMessage || buildData?.error || copy.buildError);
      }

      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // A completed submission must still show success if storage is blocked.
      }
      setCreatedProduct(null);
      setResultId(product.id);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : copy.unexpectedError);
    } finally {
      setLoading(false);
    }
  }

  if (resultId) {
    return (
      <ResourceSubmissionSuccess
        resultId={resultId}
        locale={locale}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      <div className="space-y-1.5">
        <h1 className="font-display text-primary">{copy.resourceTitle}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted">{copy.resourceDescription}</p>
      </div>

      {createdProduct && (
        <div className="flex flex-col gap-3 rounded-lg border border-base bg-inset p-4 sm:flex-row sm:items-center sm:justify-between">
          <p role="status" className="text-sm text-secondary">
            {copy.buildRetryReady} {copy.pendingDraftLabel} {createdProduct.slug}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startNewSubmission}
            disabled={loading}
            className="shrink-0"
          >
            {copy.startNewResource}
          </Button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-[color:var(--nexus-danger)]/25 bg-danger-soft p-4 text-sm text-danger"
        >
          {error}
        </div>
      )}

      <MtaMetaInspectorPanel
        onApplyMinimumVersion={setMtaVersionTarget}
        minimumVersionLocked={loading || Boolean(createdProduct)}
      />

      <form
        key={formEpoch}
        onSubmit={submit}
        aria-busy={loading}
        className="nexus-panel grid grid-cols-1 gap-4 p-5 shadow-nexus-sm sm:grid-cols-2 sm:p-6"
      >
        <fieldset disabled={loading} className="contents">
          <label className={labelClass}>
            <span className={labelTextClass}>{copy.title}</span>
            <input
              name="title"
              required
              minLength={3}
              maxLength={120}
              className={fieldClass}
              disabled={Boolean(createdProduct)}
            />
          </label>

          <label className={labelClass}>
            <span className={labelTextClass}>{copy.slug}</span>
            <input
              name="slug"
              required
              minLength={3}
              maxLength={120}
              pattern="[a-z0-9-]+"
              autoCapitalize="none"
              spellCheck={false}
              className={fieldClass}
              disabled={Boolean(createdProduct)}
            />
          </label>

          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>{copy.shortDescription}</span>
            <input
              name="shortDescription"
              maxLength={240}
              className={fieldClass}
              disabled={Boolean(createdProduct)}
            />
          </label>

          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>{copy.description}</span>
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={10_000}
              rows={6}
              className={fieldClass}
              disabled={Boolean(createdProduct)}
            />
          </label>

          <label className={labelClass}>
            <span className={labelTextClass}>{copy.type}</span>
            <select name="type" className={fieldClass} disabled={Boolean(createdProduct)}>
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {copy[PRODUCT_PUBLISHING_KEYS[type]]}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            <span className={labelTextClass}>{copy.tags}</span>
            <input
              name="tags"
              maxLength={500}
              className={fieldClass}
              disabled={Boolean(createdProduct)}
            />
          </label>

          <label className={labelClass}>
            <span className={labelTextClass}>{copy.version}</span>
            <input
              name="version"
              defaultValue="1.0.0"
              required
              maxLength={64}
              pattern="v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?"
              className={fieldClass}
            />
          </label>

          <label className={labelClass}>
            <span className={labelTextClass}>{copy.minMtaVersion}</span>
            <input
              name="mtaMinVersion"
              value={mtaVersionTarget}
              onChange={(event) => setMtaVersionTarget(event.target.value)}
              pattern="1\.[0-9]+(\.[0-9]+)?"
              maxLength={64}
              className={fieldClass}
              disabled={Boolean(createdProduct)}
            />
          </label>

          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>{copy.dependencies}</span>
            <input
              name="dependencies"
              maxLength={1000}
              placeholder="core-ui, vehicle-pack"
              className={fieldClass}
              disabled={Boolean(createdProduct)}
            />
          </label>

          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>{copy.buildArchive}</span>
            <input
              name="file"
              type="file"
              accept=".zip,.rar,.7z,.lua"
              required
              className="w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent"
            />
            <span className="text-xs text-muted">{buildFileRequirements}</span>
          </label>

          <label className={`${labelClass} sm:col-span-2`}>
            <span className={labelTextClass}>{copy.releaseNotes}</span>
            <textarea name="releaseNotes" rows={3} maxLength={5000} className={fieldClass} />
          </label>

          <Button
            type="submit"
            isLoading={loading}
            disabled={!draftReady}
            className="sm:col-span-2"
          >
            {!draftReady
              ? copy.checkingDraft
              : loading
                ? copy.submitting
                : createdProduct
                  ? copy.retryBuild
                  : copy.submit}
          </Button>
        </fieldset>
      </form>
    </div>
  );
}
