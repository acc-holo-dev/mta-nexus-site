"use client";

import { PRODUCT_TYPES } from "@nexus/domain";
import { Button, Input } from "@nexus/ui";
import { type FormEvent, useEffect, useState } from "react";
import { confirmedAuthorBuild } from "../lib/author-resource-response";
import {
  MAX_BUILD_FILE_SIZE_BYTES,
  validateBuildFileSelection,
} from "../lib/build-file-validation";
import { buildPackageCopy } from "../lib/build-package-i18n";
import { confirmedCreatedResource } from "../lib/new-resource-response";
import {
  createPendingResourceDraft,
  PENDING_RESOURCE_DRAFT_KEY,
  parsePendingResourceDraft,
  pendingResourceDraftKey,
} from "../lib/pending-resource-draft";
import { PRODUCT_PUBLISHING_KEYS } from "../lib/product-type-labels";
import { getResourceSubmissionErrorMessage } from "../lib/publishing-error-message";
import { useNexusLocale } from "./locale-context";
import { MtaMetaInspectorPanel } from "./mta-meta-inspector-panel";
import { ResourceSubmissionSuccess } from "./resource-submission-success";

const controlClass =
  "h-10 w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const textareaClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-primary transition-colors placeholder:text-[color:var(--nexus-text-faint)] hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--nexus-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--nexus-page)]";
const nativeLabelClass = "block font-label uppercase text-secondary";
const fileClass =
  "w-full rounded-lg border border-base bg-inset px-3 py-2 text-sm text-secondary file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-accent";

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
    return <ResourceSubmissionSuccess resultId={resultId} locale={locale} />;
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
          <Input
            id="resource-title"
            name="title"
            label={copy.title}
            required
            minLength={3}
            maxLength={120}
            disabled={Boolean(createdProduct)}
          />

          <Input
            id="resource-slug"
            name="slug"
            label={copy.slug}
            required
            minLength={3}
            maxLength={120}
            pattern="[a-z0-9-]+"
            autoCapitalize="none"
            spellCheck={false}
            disabled={Boolean(createdProduct)}
          />

          <div className="sm:col-span-2">
            <Input
              id="resource-short-description"
              name="shortDescription"
              label={copy.shortDescription}
              maxLength={240}
              disabled={Boolean(createdProduct)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="resource-description" className={nativeLabelClass}>
              {copy.description}
            </label>
            <textarea
              id="resource-description"
              name="description"
              required
              minLength={10}
              maxLength={10_000}
              rows={6}
              disabled={Boolean(createdProduct)}
              className={textareaClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="resource-type" className={nativeLabelClass}>
              {copy.type}
            </label>
            <select
              id="resource-type"
              name="type"
              className={controlClass}
              disabled={Boolean(createdProduct)}
            >
              {PRODUCT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {copy[PRODUCT_PUBLISHING_KEYS[type]]}
                </option>
              ))}
            </select>
          </div>

          <Input
            id="resource-tags"
            name="tags"
            label={copy.tags}
            maxLength={500}
            disabled={Boolean(createdProduct)}
          />

          <Input
            id="resource-version"
            name="version"
            label={copy.version}
            defaultValue="1.0.0"
            required
            maxLength={64}
            pattern="v?[0-9]+\.[0-9]+(\.[0-9]+)?(-[a-zA-Z0-9.]+)?"
          />

          <Input
            id="resource-min-mta"
            name="mtaMinVersion"
            label={copy.minMtaVersion}
            value={mtaVersionTarget}
            onChange={(event) => setMtaVersionTarget(event.target.value)}
            pattern="1\.[0-9]+(\.[0-9]+)?"
            maxLength={64}
            disabled={Boolean(createdProduct)}
          />

          <div className="sm:col-span-2">
            <Input
              id="resource-dependencies"
              name="dependencies"
              label={copy.dependencies}
              maxLength={1000}
              placeholder="core-ui, vehicle-pack"
              disabled={Boolean(createdProduct)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="resource-build-file" className={nativeLabelClass}>
              {copy.buildArchive}
            </label>
            <input
              id="resource-build-file"
              name="file"
              type="file"
              accept=".zip,.rar,.7z,.lua"
              required
              className={fileClass}
            />
            <span className="text-xs text-muted">{buildFileRequirements}</span>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="resource-release-notes" className={nativeLabelClass}>
              {copy.releaseNotes}
            </label>
            <textarea
              id="resource-release-notes"
              name="releaseNotes"
              rows={3}
              maxLength={5000}
              className={textareaClass}
            />
          </div>

          <Button
            type="submit"
            isLoading={loading}
            disabled={!draftReady}
            className="min-h-11 sm:col-span-2"
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
